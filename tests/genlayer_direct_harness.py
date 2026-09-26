"""
A minimal stand-in for GenLayer's own "direct mode" testing (the
`direct_vm` / `direct_deploy` fixtures documented for genlayer-test /
GLSim: https://docs.genlayer.com/api-references/genlayer-test/direct).

That package requires network access to install and isn't available in
this sandbox, so this module reimplements just enough of the `genlayer`
package surface (Address, gl.Contract, gl.public.*, gl.vm.*,
gl.nondet.exec_prompt, gl.get_contract_at, storage containers, and a
pinned transaction clock) to *execute the real contract source files*
(contracts/sentinel_guard.py, contracts/demo_vault.py) unmodified, the
same way the actual GenVM runtime would for the deterministic parts of
each call.

It intentionally does NOT try to fake consensus, appeals, or fee
accounting - it only needs to support:
  - calling @gl.public.view / @gl.public.write(.payable) methods
  - gl.vm.run_nondet_unsafe(leader_fn, validator_fn) with a scripted LLM
    response queue
  - gl.get_contract_at(...).emit(on="finalized").method(...), queued and
    only executed when finalize() is called - this is what lets the
    tests exercise the exact race the steward asked about (querying
    guard state / calling verify_target_hook *before* the finalized
    message has run)
  - a controllable transaction clock so grace-period logic can be tested
    deterministically

If/when genlayer-test is available in CI, these tests should be ported to
real `direct_vm` / `direct_deploy` fixtures; the test bodies below only
call public contract methods, so the port is mechanical.
"""

import datetime as _dt
import json
import sys
import types


class Address:
    def __init__(self, value):
        self.as_hex = (value.as_hex if isinstance(value, Address) else str(value)).lower()

    def __eq__(self, other):
        if isinstance(other, Address):
            return self.as_hex == other.as_hex
        if isinstance(other, str):
            return self.as_hex == other.lower()
        return NotImplemented

    def __hash__(self):
        return hash(self.as_hex)

    def __repr__(self):
        return f"Address({self.as_hex})"


class UserError(Exception):
    def __init__(self, message=""):
        super().__init__(message)
        self.message = message


class VMError(Exception):
    def __init__(self, message=""):
        super().__init__(message)
        self.message = message


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class DirectVM:
    """The scriptable environment a test drives: clock, sender, LLM queue, message queue."""

    def __init__(self):
        self.world = {}          # Address -> deployed contract instance
        self.pending = []        # queued on="finalized" messages: (addr, method, args, kwargs)
        self.now = 1_800_000_000
        self.sender = None
        self.contract_address = None
        self.llm_queue = []
        self.exec_log = []

    # -- clock / sender -----------------------------------------------------

    def warp(self, seconds_from_now):
        self.now += seconds_from_now

    def mock_llm(self, response_dict):
        """Queue the next exec_prompt() response (as a dict, will be json-encoded)."""
        self.llm_queue.append(json.dumps(response_dict))

    # -- deployment / calls --------------------------------------------------

    def deploy(self, contract_cls, sender, addr, *args):
        self.sender = Address(sender)
        self.contract_address = Address(addr)
        _msg.sender_address = self.sender
        _msg.contract_address = self.contract_address
        _msg.value = 0
        instance = contract_cls.__new__(contract_cls)
        instance.targets, instance.incidents, instance.trust = {}, {}, {}
        instance.target_ids, instance.incident_ids = [], []
        instance.reporter_last, instance.reporter_n = {}, {}
        instance.balance = 0
        instance.__init__(*args)
        self.world[Address(addr)] = instance
        return instance

    def call(self, contract, sender, method, *args, value=0, **kwargs):
        target_addr = next(addr for addr, inst in self.world.items() if inst is contract)
        self.sender = Address(sender)
        self.contract_address = target_addr
        _msg.sender_address = self.sender
        _msg.contract_address = self.contract_address
        _msg.value = value
        return getattr(contract, method)(*args, **kwargs)

    def finalize(self):
        """Run every queued on='finalized' message once (a single finality round)."""
        batch, self.pending = self.pending, []
        for addr, name, args, kwargs, src in batch:
            _msg.sender_address = src
            _msg.contract_address = addr
            _msg.value = 0
            instance = self.world[addr]
            try:
                getattr(instance, name)(*args, **kwargs)
                self.exec_log.append(f"finalized {addr.as_hex[:8]}.{name} ok")
            except UserError as error:
                self.exec_log.append(f"finalized {addr.as_hex[:8]}.{name} REVERTED: {error.message}")

    def finalize_all(self, max_rounds=5):
        """Finalized messages can themselves queue further finalized messages (e.g. confirm_pause)."""
        for _ in range(max_rounds):
            if not self.pending:
                break
            self.finalize()


# --- module-global message/clock context, read by the fake `gl` namespace --

_msg = types.SimpleNamespace(sender_address=None, contract_address=None, value=0)
_active_vm = {"vm": None}


def _now_ts():
    return _active_vm["vm"].now


class _FakeDateTime(_dt.datetime):
    @classmethod
    def now(cls, tz=None):
        return _dt.datetime.fromtimestamp(_now_ts(), tz or _dt.timezone.utc)


_dt.datetime = _FakeDateTime


class _View:
    def __init__(self, addr):
        self.addr = addr

    def __getattr__(self, name):
        def call(*args, **kwargs):
            vm = _active_vm["vm"]
            instance = vm.world.get(self.addr)
            if instance is None or not hasattr(instance, name):
                raise UserError("no such view")
            saved_sender, saved_addr = _msg.sender_address, _msg.contract_address
            _msg.sender_address, _msg.contract_address = self.addr, self.addr
            try:
                return getattr(instance, name)(*args, **kwargs)
            finally:
                _msg.sender_address, _msg.contract_address = saved_sender, saved_addr

        return call


class _Emit:
    def __init__(self, addr, on):
        self.addr = addr
        self.on = on

    def __getattr__(self, name):
        def call(*args, **kwargs):
            vm = _active_vm["vm"]
            if self.on == "finalized":
                vm.pending.append((self.addr, name, args, kwargs, _msg.contract_address))
            else:  # "accepted" - runs immediately in this simplified harness
                saved_sender = _msg.sender_address
                _msg.sender_address = _msg.contract_address
                try:
                    getattr(vm.world[self.addr], name)(*args, **kwargs)
                finally:
                    _msg.sender_address = saved_sender

        return call

    def emit_transfer(self, **kwargs):
        pass


class _ContractHandle:
    def __init__(self, addr):
        self.addr = addr

    def view(self):
        return _View(self.addr)

    def emit(self, on="finalized", value=0):
        return _Emit(self.addr, on)

    def emit_transfer(self, **kwargs):
        pass

    @property
    def balance(self):
        vm = _active_vm["vm"]
        instance = vm.world.get(self.addr)
        return getattr(instance, "balance", 0) if instance else 0


def _get_contract_at(addr):
    return _ContractHandle(Address(addr))


def run_nondet_unsafe(leader_fn, validator_fn):
    result = leader_fn()
    accepted = validator_fn(Return(result))
    if not accepted:
        raise UserError("[CONSENSUS] validators rejected the leader's proposal")
    return result


def exec_prompt(prompt, response_format=None):
    vm = _active_vm["vm"]
    if not vm.llm_queue:
        raise UserError("test forgot to vm.mock_llm(...) a response")
    # Leader and every re-run inside validator_fn ask again; if only one
    # response was queued, keep answering it (both leader and validator see
    # the same script unless the test explicitly queues a second, different
    # one to simulate a disagreement).
    return vm.llm_queue[0] if len(vm.llm_queue) == 1 else vm.llm_queue.pop(0)


class Contract:
    balance = 0


def _identity(f):
    return f


_write = _identity
_write.payable = _identity

gl = types.SimpleNamespace(
    Contract=Contract,
    public=types.SimpleNamespace(view=_identity, write=_write),
    message=_msg,
    message_raw={"is_init": False},
    vm=types.SimpleNamespace(
        UserError=UserError,
        VMError=VMError,
        Return=Return,
        run_nondet_unsafe=run_nondet_unsafe,
    ),
    nondet=types.SimpleNamespace(exec_prompt=exec_prompt),
    get_contract_at=_get_contract_at,
    evm=types.SimpleNamespace(contract_interface=lambda cls: (lambda addr: _ContractHandle(Address(addr)))),
)


class _StorageMap(dict):
    pass


class _StorageArray(list):
    pass


class _MapSubscript:
    def __getitem__(self, key):
        return _StorageMap


class _ArraySubscript:
    def __getitem__(self, key):
        return _StorageArray


def _install_fake_genlayer_module():
    module = types.ModuleType("genlayer")
    module.gl = gl
    module.Address = Address
    for name in ("u8", "u16", "u32", "u64", "u128", "u256", "i8", "i16", "i32", "i64", "i128", "i256"):
        setattr(module, name, int)
    module.bigint = int
    module.allow_storage = lambda cls: cls
    module.TreeMap = _MapSubscript()
    module.DynArray = _ArraySubscript()
    sys.modules["genlayer"] = module


_install_fake_genlayer_module()


def load_contract_module(path, module_name):
    """Executes a real GenVM contract .py file against the fake genlayer module above."""
    source = open(path, encoding="utf-8").read()
    namespace = {"__name__": module_name}
    exec(compile(source, path, "exec"), namespace)
    return namespace


def new_vm():
    vm = DirectVM()
    _active_vm["vm"] = vm
    return vm
