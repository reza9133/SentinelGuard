#!/usr/bin/env python3
"""
Deploy SentinelGuard (+ the DemoVault example target) to GenLayer.

    python scripts/deploy.py --network studio-next   (default)
    python scripts/deploy.py --network studionet

Run this on your own machine - it needs to reach the Studio RPCs, which this
build environment cannot. It:

1. Loads or creates an account (key kept in .env, GENLAYER_PRIVATE_KEY).
2. Funds it from the chosen network's programmatic faucet if the balance is low.
3. Deploys the pair of contracts that network runs, then wires
   DemoVault(sentinel=<SentinelGuard address>).
4. Calls register_target(demo_vault_address, <rulebook>, pausable=True) so
   there is something live to point a frontend at immediately.
5. Writes deployed.<network>.json with every address.

Two networks, one contract pair, only the deploy-time details differ:

  studio-next   chain 61997   contracts/sentinel_guard.py, contracts/demo_vault.py
                consensus v0.6 (preview/RC), charges a fee deposit on every
                write, needs genlayer-py 0.19.0rc2 specifically.

  studionet     chain 61999   contracts/sentinel_guard.py, contracts/demo_vault.py
                stable consensus, no fee deposit, needs genlayer-py 0.18.x
                (anything before 0.19.0rc2 - that release targets the
                studio-next preview the same way 0.18 cannot reach it).

The contract's own Python API (gl.Contract, gl.get_contract_at,
gl.vm.run_nondet_unsafe, gl.message_raw, @gl.public.write/.view) is the
same on every GenLayer network - there is no per-network contract-code
variant, only per-network deploy tooling (fee handling, RPC, chain id,
matching genlayer-py line), which is what this script parametrizes. Only
one genlayer-py line can be installed at a time, so switching --network
may mean reinstalling requirements.txt - see README for exact versions.

Known sharp edge on studio-next specifically, read before you demo
report_incident live there: the SDK estimates a write's fee by simulating
it once. For `report_incident` / `request_resume_review` that simulation
runs the LLM adjudication too, and whatever it decides during THAT single
dry run is what gets a fee allocation. If the real, on-chain consensus
round reaches a different call, the internal sentinel_pause()/
sentinel_resume() call can fail with "fee no_matching_allocation" even
though the adjudication itself succeeded. --force-fee-buffer always
reserves a spare allocation for it regardless of what the dry run
predicted. This does not apply to studionet, which has no fee deposit.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"

GEN = 10**18
MIN_BALANCE = 10 * GEN
FUND_AMOUNT = 500 * GEN
MAX_TIMEUNITS = 600

RULEBOOK = (
    "Balance may never go negative. withdraw() may never move more than the "
    "vault's current balance in a single call. deposit()/withdraw() must "
    "both be blocked while the vault reports itself paused."
)

NETWORKS = {
    "studio-next": dict(
        chain_id=61997,
        rpc="https://studio-dev.genlayer.com/api",
        explorer="https://explorer-studio-dev.genlayer.com",
        contracts_dir=ROOT / "contracts",
        v06=True,
        min_sdk="genlayer-py==0.19.0rc2",
    ),
    "studionet": dict(
        chain_id=61999,
        rpc="https://studio.genlayer.com/api",
        explorer="https://explorer-studio.genlayer.com",
        contracts_dir=ROOT / "contracts",
        v06=False,
        min_sdk="genlayer-py<0.19 (e.g. genlayer-py==0.18.*)",
    ),
}


def _load_env() -> None:
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def _save_key(private_key: str) -> None:
    lines = [] if not ENV_PATH.exists() else ENV_PATH.read_text(encoding="utf-8").splitlines()
    lines = [l for l in lines if not l.startswith("GENLAYER_PRIVATE_KEY=")]
    lines.append(f"GENLAYER_PRIVATE_KEY={private_key}")
    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"  wrote account key to {ENV_PATH.name} - do not commit this file")


def _account():
    from genlayer_py import create_account

    key = os.environ.get("GENLAYER_PRIVATE_KEY")
    if key:
        return create_account(private_key=key)
    account = create_account()
    _save_key(account.private_key.hex() if hasattr(account.private_key, "hex") else str(account.private_key))
    return account


def _chain_object(network: str, cfg: dict):
    """
    The genlayer_py chain object for this network. studio-next needs the
    v0.6 SDK line (genlayer_py.chains.studio_devnet); studionet is one of
    the SDK's long-standing built-ins.
    """
    if network == "studio-next":
        try:
            from genlayer_py.chains import studio_devnet
        except ImportError as error:
            raise SystemExit(
                f"studio-next needs {cfg['min_sdk']}; this interpreter's genlayer_py "
                "does not export studio_devnet. Reinstall requirements.txt for "
                "this network - see README."
            ) from error
        studio_devnet.rpc_urls = {"default": {"http": [cfg["rpc"]]}}
        return studio_devnet
    from genlayer_py import studionet

    studionet.rpc_urls = {"default": {"http": [cfg["rpc"]]}}
    return studionet


def _fee_options(estimate: dict) -> dict:
    options = {"distribution": estimate["distribution"], "feeValue": estimate["feeValue"]}
    allocations = estimate.get("messageAllocations")
    if allocations:
        options["messageAllocations"] = allocations
    return options


class Client:
    """
    Talks to one network. v0.6 (studio-next) attaches a fee deposit to every
    deploy/write and waits on "decided"/"finalized"; the older studionet
    sends plain calls and waits on the ACCEPTED/FINALIZED status names.
    """

    def __init__(self, network: str, account):
        from genlayer_py import create_client

        self.network = network
        self.cfg = NETWORKS[network]
        self.v06 = self.cfg["v06"]
        self.account = account
        self.client = create_client(chain=_chain_object(network, self.cfg), account=account)

    def balance(self, address: str) -> int:
        return int(self.client.get_balance(address))

    def fund(self, address: str, amount: int = FUND_AMOUNT) -> None:
        before = self.balance(address)
        try:
            self.client.fund_account(address, amount)
        except Exception as error:  # noqa: BLE001 - faucet sometimes errors while still crediting
            print(f"    fund_account reported {str(error)[:90]}, checking balance instead")
        time.sleep(2)
        after = self.balance(address)
        print(f"    {address[:10]}...  {before / GEN:.2f} -> {after / GEN:.2f} GEN")

    def ensure_funded(self, address: str) -> None:
        if self.balance(address) < MIN_BALANCE:
            self.fund(address)

    def deploy(self, path: pathlib.Path, args: list) -> str:
        code = path.read_text(encoding="utf-8")
        call = {"code": code, "args": args}
        if self.v06:
            call["fees"] = self._flat_fees()
        tx = self.client.deploy_contract(**call)
        receipt = self._wait(tx, final=True)
        address = self._address_from(receipt)
        if not address:
            raise RuntimeError(f"deploy of {path.name} produced no address: {receipt}")
        print(f"  {path.name} -> {address}")
        return address

    def write(self, address: str, method: str, args: list, value: int = 0, force_fee_buffer: bool = False) -> dict:
        call = {"address": address, "function_name": method, "args": args, "value": value}
        if self.v06:
            call["fees"] = self._write_fees(address, method, args, force_fee_buffer)
        tx = self.client.write_contract(**call)
        return self._wait(tx, final=False)

    def read(self, address: str, method: str, args: list | None = None):
        if self.v06:
            return self.client.read_contract(
                address=address, function_name=method, args=args or [], account=self.account,
            )
        return self.client.read_contract(address, method, args or [])

    def _wait(self, tx_hash, final: bool) -> dict:
        if self.v06:
            return self.client.wait_for_transaction_receipt(
                transaction_hash=tx_hash,
                wait_until="finalized" if final else "decided",
                interval=3000, retries=150 if final else 100,
            )
        return self.client.wait_for_transaction_receipt(
            transaction_hash=tx_hash,
            status="FINALIZED" if final else "ACCEPTED",
            interval=3000, retries=150 if final else 100,
        )

    def _write_fees(self, address: str, method: str, args: list, force_fee_buffer: bool) -> dict:
        try:
            estimate = self.client.estimate_transaction_fees_for_write(
                address=address, function_name=method, account=self.account, args=args, value=0,
            )
            if force_fee_buffer:
                estimate = self._buffered(estimate)
            return _fee_options(estimate)
        except Exception:  # noqa: BLE001 - a write the estimator cannot simulate
            return self._flat_fees()

    def _flat_fees(self) -> dict:
        return self.client.estimate_transaction_fees({
            "leaderTimeunitsAllocation": MAX_TIMEUNITS,
            "validatorTimeunitsAllocation": MAX_TIMEUNITS,
            "totalMessageFees": 0,
            "rotations": [1],
        })

    def _buffered(self, estimate: dict) -> dict:
        """
        studio-next only: reserve a spare internal-message allocation at the
        root, sized like the root call's own budget, so a decision the dry
        run did not predict still has something to spend. Unused budget is
        refunded at finalization. See the module docstring.
        """
        from genlayer_py.transactions.fees import (
            MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
            derive_internal_message_call_key,
        )

        nodes = [dict(n) for n in (estimate.get("messageAllocations") or [])]
        if not nodes:
            return estimate
        root = nodes[0]
        nodes.append({
            "messageType": 1,
            "onAcceptance": False,
            "parentIndex": MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
            "recipient": root["recipient"],
            "callKey": derive_internal_message_call_key("sentinel_pause"),
            "budget": root["budget"],
            "feeParams": root["feeParams"],
        })
        options = {k: v for k, v in (estimate.get("distribution") or {}).items() if k != "totalMessageFees"}
        options["messageAllocations"] = nodes
        return self.client.estimate_transaction_fees(options)

    @staticmethod
    def _address_from(receipt) -> str | None:
        if isinstance(receipt, dict):
            for key in ("contract_address", "contractAddress"):
                if receipt.get(key):
                    return receipt[key]

            def dig(node):
                if isinstance(node, dict):
                    for k, v in node.items():
                        if k in ("contract_address", "contractAddress") and v:
                            return v
                    for v in node.values():
                        found = dig(v)
                        if found:
                            return found
                if isinstance(node, list):
                    for v in node:
                        found = dig(v)
                        if found:
                            return found
                return None

            return dig(receipt)
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--network", choices=sorted(NETWORKS), default="studio-next")
    parser.add_argument("--force-fee-buffer", action="store_true",
                         help="studio-next only: always reserve a spare fee allocation on "
                              "report_incident/request_resume_review, see module docstring")
    parser.add_argument("--out", default=None,
                         help="where to write the deployment record, default deployed.<network>.json")
    args = parser.parse_args()

    cfg = NETWORKS[args.network]
    out_path = pathlib.Path(args.out) if args.out else ROOT / f"deployed.{args.network}.json"

    _load_env()
    account = _account()
    print(f"network  {args.network}  (chain {cfg['chain_id']})")
    print(f"account  {account.address}")

    client = Client(args.network, account)
    print("\nfunding")
    client.ensure_funded(account.address)

    print("\ndeploying")
    guard_path = cfg["contracts_dir"] / "sentinel_guard.py"
    vault_path = cfg["contracts_dir"] / "demo_vault.py"
    guard = client.deploy(guard_path, [])
    vault = client.deploy(vault_path, [guard])

    print("\nregistering the demo vault with SentinelGuard")
    client.write(guard, "register_target", [vault, RULEBOOK, True], force_fee_buffer=args.force_fee_buffer)
    row = json.loads(client.read(guard, "get_target", [vault]))
    print(f"  status: {row['status']}, confidence_bar: {row['confidence_bar']}")

    deployment = {
        "network": args.network,
        "chain_id": cfg["chain_id"],
        "rpc": cfg["rpc"],
        "explorer": cfg["explorer"],
        "sentinel_guard": guard,
        "demo_vault": vault,
        "owner": account.address,
        "rulebook": RULEBOOK,
        "deployed_at": int(time.time()),
    }
    out_path.write_text(json.dumps(deployment, indent=2) + "\n", encoding="utf-8")
    print(f"\nwrote {out_path.name}")
    print(f"  sentinel_guard  {guard}")
    print(f"  demo_vault      {vault}")
    print(f"  explorer        {cfg['explorer']}/address/{guard}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
