# SentinelGuard

**Track:** Autonomous Protocols — GenLayer hackathon (Studio Next network)

An emergency-halt module and self-tuning governance layer, in one contract.
Any contract can register with SentinelGuard and declare its own rulebook.
Anyone can report an incident with evidence; SentinelGuard adjudicates it
through an LLM-backed consensus round (no human vote, ever) and — if the
call clears the target's own confidence bar — immediately pauses the
target. That confidence bar is not fixed: SentinelGuard tunes it up or down
for each target based on its own track record, autonomously.

This covers two of the four track prompts at once: **"emergency halt
module"** and **"contracts that govern contracts... tunes its own rules
with no one voting."**

## Files

- `contracts/sentinel_guard.py` — the contract. This is the whole submission.
  Runs unmodified on every GenLayer network (Studio Next / studio-dev,
  Studionet, Bradbury, Asimov, localnet) — there's no per-network contract
  code, only per-network deploy tooling (see below).
- `contracts/demo_vault.py` — a tiny example target so you have something
  real to deploy and point SentinelGuard at while building the frontend.
  Not part of the core idea.

## Which network to submit on

⚠️ Confirm this before you submit anything: check the Autonomous Protocols
track's submission page (`portal.genlayer.foundation/agent-tank/hackathon/submit?track=Autonomous%20Protocols`)
for which network it actually expects. `scripts/deploy.py` supports both;
submitting to the wrong one means judges can't find your contract.

|  | Studio Next (studio-dev) | Studionet |
|---|---|---|
| chain id | 61997 | 61999 |
| consensus | v0.6 (preview/RC) | stable |
| RPC | `https://studio-dev.genlayer.com/api` | `https://studio.genlayer.com/api` |
| explorer | `explorer-studio-dev.genlayer.com` | `explorer-studio.genlayer.com` |
| fee deposit on writes | yes | no |
| genlayer-py | `0.19.0rc2` | `0.18.*` (anything before `0.19.0rc2`) |

The contract's own Python API — `gl.Contract`, `gl.get_contract_at`,
`gl.vm.run_nondet_unsafe`, `gl.message_raw`, `@gl.public.write` /
`@gl.public.view`, `.emit(on="finalized").method(...)` — is identical on
both networks. Only the deploy-time details above differ, which
`scripts/deploy.py --network <name>` handles for you.


## Deploying

This build environment cannot reach either Studio's RPC (network egress
here is restricted to package registries and GitHub), so deploying has to
run on your own machine. `scripts/deploy.py` does the whole flow for
whichever network you pick:

```bash
python -m venv .venv && source .venv/bin/activate   # or your usual venv setup

# For Studio Next (default):
pip install genlayer-py==0.19.0rc2
python scripts/deploy.py --network studio-next

# For Studionet:
pip install "genlayer-py<0.19"
python scripts/deploy.py --network studionet
```

Only one genlayer-py line can be installed at a time (0.19.0rc2 targets the
studio-next preview specifically, and 0.18.x cannot reach it), so switching
networks means reinstalling. It will:
1. Create (or reuse, from `.env`) an account and fund it from that
   network's programmatic faucet.
2. Deploy `SentinelGuard` (no constructor args), then
   `DemoVault(sentinel=<SentinelGuard address>)`.
3. Call `register_target(demo_vault_address, <a sample rulebook>, pausable=True)`
   so there's a live target the moment it finishes.
4. Write `deployed.<network>.json` with both addresses — point your
   frontend's env vars at it.

After that, to see a live halt (note the `value` — see "Incident bond" below):
```
SentinelGuard.report_incident(target=<demo_vault>, evidence="withdraw() moved 900 out of a 100 balance", value=<incident_bond_amount()>)
```
and, after the 300s cooldown, to see a live resume:
```
SentinelGuard.request_resume_review(target=<demo_vault>, evidence="the balance check was patched and redeployed", value=<incident_bond_amount()>)
```

### Incident bond (anti-Sybil)

`report_incident` and `request_resume_review` are payable and require
sending at least `incident_bond_amount()` GEN (2 GEN by default,
owner-tunable via `set_incident_bond`). The bond is refunded in full,
same transaction, when the report actually triggers a halt/resume; any
other outcome (no, uncertain, or a "yes" that lands under the confidence
bar) forfeits it to the contract's own balance. Without this, reporting
was free, so an attacker protecting a vulnerable target could spam
`report_incident` with garbage evidence from unlimited addresses to walk
`confidence_bar` up to `BAR_CEILING` at zero cost — then a genuine
90%-confidence violation gets rejected because the bar is pinned at 95.
The bond makes every spam attempt cost real GEN, in either direction.
Forfeited bonds accumulate in the contract's balance (`treasury_balance()`)
and only the owner can sweep them out, via `withdraw_treasury`.

### A sharp edge on Studio Next specifically (does not apply to Studionet)

Studio Next estimates a write's fee by dry-running it once. For
`report_incident` / `request_resume_review` that dry run also runs the LLM
adjudication, and only what *that one run* decides gets a fee allocation
for the `sentinel_pause()` / `sentinel_resume()` call it might trigger. If
the real, on-chain consensus round reaches a different call (crosses the
bar when the dry run didn't, or vice versa), the internal call can revert
with `fee no_matching_allocation` even though the adjudication itself
succeeded and is visible via `get_incident`. `scripts/deploy.py --force-fee-buffer`
always reserves a spare allocation for it regardless of what the dry run
predicted, at no cost beyond a temporary deposit (unused budget is
refunded at finalization) — worth turning on before a live demo. Studionet
charges no fee deposit at all, so this doesn't come up there.

## Frontend API reference

Everything below is a write (transaction) or view (free read) on
`SentinelGuard`. Views return JSON strings unless noted; parse them client-side.

### Writes

| Method | Args | Value | Notes |
|---|---|---|---|
| `register_target` | `target: str, rulebook: str, pausable: bool` | — | Anyone. `rulebook` 20–1000 chars. |
| `update_rulebook` | `target: str, rulebook: str` | — | Only the original registrar, only while active. |
| `report_incident` | `target: str, evidence: str` | ≥ `incident_bond_amount()` | Anyone with trust ≥ 10. Returns the new `incident_id` (`str`). Refunded on halt, forfeited otherwise. |
| `request_resume_review` | `target: str, evidence: str` | ≥ `incident_bond_amount()` | Anyone, only while halted, only after the 300s cooldown. Returns the new `incident_id`. Refunded on resume, forfeited otherwise. |
| `set_incident_bond` | `amount: u256` | — | Owner-only. |
| `withdraw_treasury` | `to: str, amount: u256` | — | Owner-only. Sweeps forfeited bonds. |

### Views

| Method | Args | Returns |
|---|---|---|
| `status` | `target: str` | `"active"` \| `"halted"` |
| `get_target` | `target: str` | `{address, rulebook, registered_by, pausable, status, confidence_bar, resume_bar, halted_at, last_incident_reason, incident_count}` |
| `list_targets` | `n: u32` | array of `{address, status, confidence_bar, incident_count}`, newest first |
| `get_incident` | `incident_id: str` | `{id, target, reporter, kind, evidence, decision, confidence, reason, created_at, decided_at}` |
| `recent_incidents` | `n: u32` | array of `{id, target, kind, decision, confidence, reason, decided_at}`, newest first |
| `reporter_trust` | `reporter: str` | `u8` (0–100) |
| `incident_bond_amount` | — | `u256` (wei) |
| `treasury_balance` | — | `u256` (wei) |
| `stats` | — | `{targets, incidents, owner, incident_bond, treasury_balance}` |

`decision` is always one of `"pending" | "action" | "no_action" | "uncertain"`.
For `kind == "halt_report"`, `"action"` means the target was halted. For
`kind == "resume_review"`, `"action"` means it was resumed.

### Suggested pages

- **Registry** — list of targets (`list_targets`) with a badge for `status`
  and `confidence_bar`; a form to `register_target`.
- **Target detail** — `get_target` + its incident history
  (filter `recent_incidents` client-side, or add an indexed view later);
  a "report incident" form and, when halted, a "request resume" form.
- **Live feed** — `recent_incidents` polled on an interval, since every
  halt/resume is autonomous and can happen without the user's own action.

## Honest limitation to mention in your submission

SentinelGuard cannot force a foreign, uncooperative contract to pause —
no contract on any chain can reach into another's state uninvited. A
target must opt in at registration (`pausable=True`) by implementing
`sentinel_pause()` / `sentinel_resume()` guarded to only accept calls from
the SentinelGuard address, exactly as `demo_vault.py` does. For a target
that doesn't, SentinelGuard still becomes the authoritative, permissionless
on-chain "is this safe" flag other protocols and your frontend can check —
which is the same integration pattern already used for price oracles.
