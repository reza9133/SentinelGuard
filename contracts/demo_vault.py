# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
DemoVault - a toy contract that opts in to being governed by SentinelGuard.

This is not part of the submission's core idea; it exists so you have a
second, real contract to deploy and point SentinelGuard at while you build
and demo the frontend, without needing a third-party contract on hand.

Any real contract that wants SentinelGuard to be able to pause it just needs
these three things: a `sentinel: Address` field set at deploy time, a
`sentinel_pause()` write guarded by that address, and a `sentinel_resume()`
write guarded the same way. Everything else here is vault filler.
"""

from genlayer import *

E = "[EXPECTED] "


class DemoVault(gl.Contract):
    owner: Address
    sentinel: Address
    paused: bool
    balance: u64

    def __init__(self, sentinel: str):
        self.owner = gl.message.sender_address
        self.sentinel = Address(sentinel)
        self.paused = False
        self.balance = u64(0)

    def _require_sentinel(self) -> None:
        if gl.message.sender_address != self.sentinel:
            raise gl.vm.UserError(E + "not sentinel")

    # -- called only by SentinelGuard --------------------------------------

    @gl.public.write
    def sentinel_pause(self) -> None:
        self._require_sentinel()
        self.paused = True

    @gl.public.write
    def sentinel_resume(self) -> None:
        self._require_sentinel()
        self.paused = False

    # -- ordinary vault behaviour, blocked while paused ---------------------

    @gl.public.write
    def deposit(self, amount: u64) -> None:
        if self.paused:
            raise gl.vm.UserError(E + "paused")
        self.balance = u64(int(self.balance) + int(amount))

    @gl.public.write
    def withdraw(self, amount: u64) -> None:
        if self.paused:
            raise gl.vm.UserError(E + "paused")
        if int(amount) > int(self.balance):
            raise gl.vm.UserError(E + "insufficient balance")
        self.balance = u64(int(self.balance) - int(amount))

    # -- views ----------------------------------------------------------------

    @gl.public.view
    def is_paused(self) -> bool:
        return self.paused

    @gl.public.view
    def get_balance(self) -> u64:
        return self.balance
