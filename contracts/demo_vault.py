# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
DemoVault - an example target contract that opts in to being governed by SentinelGuard.

Features:
- Exposes authenticated state observations via sentinel_observe().
- Provides target authorization queries (is_sentinel_authorized, owner).
- Retains a target-controlled reclaim path (reclaim_sentinel_guard).
- Confirms finalized pause and resume hook execution back to SentinelGuard.
- Supports hook failure simulation for testing edge cases.
"""

import json
from genlayer import *

E = "[EXPECTED] "


class DemoVault(gl.Contract):
    owner_addr: Address   # NOT named `owner`: that would collide with the owner() view below
    sentinel: Address
    paused: bool
    funds: u64            # NOT named `balance`: gl.Contract already has a native `balance`
    simulate_hook_failure: bool

    def __init__(self, sentinel: str):
        self.owner_addr = gl.message.sender_address
        self.sentinel = Address(sentinel)
        self.paused = False
        self.funds = u64(0)
        self.simulate_hook_failure = False

    def _require_sentinel(self) -> None:
        if gl.message.sender_address != self.sentinel:
            raise gl.vm.UserError(E + "not sentinel")

    def _require_owner(self) -> None:
        if gl.message.sender_address != self.owner_addr:
            raise gl.vm.UserError(E + "not owner")

    # -- hook failure simulation (for testing) -------------------------------

    @gl.public.write
    def set_simulate_hook_failure(self, fail: bool) -> None:
        """Owner-only helper to simulate hook failure for testing."""
        self._require_owner()
        self.simulate_hook_failure = fail

    # -- target-controlled reclaim path ---------------------------------------

    @gl.public.write
    def reclaim_sentinel_guard(self, new_controller: str) -> None:
        """
        Target-controlled reclaim: The target owner can trigger the target contract
        to reclaim control of registration and rulebook in SentinelGuard.
        """
        self._require_owner()
        gl.get_contract_at(self.sentinel).emit(on="finalized").reclaim_target_control(
            gl.message.contract_address.as_hex, new_controller
        )

    # -- called only by SentinelGuard -----------------------------------------

    @gl.public.write
    def sentinel_pause(self) -> None:
        self._require_sentinel()
        if self.simulate_hook_failure:
            raise gl.vm.UserError(E + "simulated hook failure")
        self.paused = True
        # Notify SentinelGuard that the finalized pause hook executed successfully
        gl.get_contract_at(self.sentinel).emit(on="finalized").confirm_pause(
            gl.message.contract_address.as_hex
        )

    @gl.public.write
    def sentinel_resume(self) -> None:
        self._require_sentinel()
        if self.simulate_hook_failure:
            raise gl.vm.UserError(E + "simulated hook failure")
        self.paused = False
        # Notify SentinelGuard that the finalized resume hook executed successfully
        gl.get_contract_at(self.sentinel).emit(on="finalized").confirm_resume(
            gl.message.contract_address.as_hex
        )

    # -- ordinary vault behaviour, blocked while paused ------------------------

    @gl.public.write
    def deposit(self, amount: u64) -> None:
        if self.paused:
            raise gl.vm.UserError(E + "paused")
        self.funds = u64(int(self.funds) + int(amount))

    @gl.public.write
    def withdraw(self, amount: u64) -> None:
        if self.paused:
            raise gl.vm.UserError(E + "paused")
        if int(amount) > int(self.funds):
            raise gl.vm.UserError(E + "insufficient balance")
        self.funds = u64(int(self.funds) - int(amount))

    # -- views and observations -----------------------------------------------

    @gl.public.view
    def sentinel_observe(self) -> str:
        """
        Returns authenticated on-chain state observation for SentinelGuard.
        Includes pause state, balance, owner, and sentinel addresses. SentinelGuard adds
        its own provenance (target address, method, time) around this, so the vault
        does not need to vouch for its own address.
        """
        return json.dumps({
            "target": gl.message.contract_address.as_hex,
            "is_paused": bool(self.paused),
            "balance": int(self.funds),
            "owner": self.owner_addr.as_hex,
            "sentinel": self.sentinel.as_hex,
        }, sort_keys=True)

    @gl.public.view
    def is_paused(self) -> bool:
        return self.paused

    @gl.public.view
    def sentinel_is_paused(self) -> bool:
        return self.paused

    @gl.public.view
    def get_balance(self) -> u64:
        return self.funds

    @gl.public.view
    def owner_address(self) -> Address:
        return self.owner_addr

    @gl.public.view
    def owner(self) -> Address:
        return self.owner_addr

    @gl.public.view
    def is_sentinel_authorized(self, addr: str) -> bool:
        """Only the vault's own owner may manage its SentinelGuard registration."""
        return Address(addr) == self.owner_addr
