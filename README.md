# SentinelGuard

Autonomous emergency-halt and self-tuning guardian contract for GenLayer's
Autonomous Protocols hackathon track.

Any contract can register itself with SentinelGuard and declare its own
rulebook. Anyone can report an incident with evidence; SentinelGuard
adjudicates it through validator consensus and, if the call clears the
target's own confidence bar, halts it immediately — no proposal, no vote.
The confidence bar and reporter trust tune themselves over time based on
near-misses and false alarms, and every report requires a GEN bond that is
only refunded when it actually triggers a halt/resume, to keep the
self-tuning mechanism Sybil-resistant.

## Deployed addresses (Studionet)

| Contract | Address |
|---|---|
| SentinelGuard | `0xdF396341809A2A3d1A4E1149D14FBdB5856BCD2E` |
| DemoVault | `0x5e04809a896C5e04D97406b955a9bFf725230239` |

## Repo layout

```
SentinelGuard/
├── contracts/           the Intelligent Contracts
│   ├── sentinel_guard.py
│   └── demo_vault.py
├── scripts/
│   └── deploy.py        deploys both, wires DemoVault to SentinelGuard
├── requirements.txt      genlayer-py, pinned per network (see file)
└── frontend/             React + Vite dApp - see frontend/README.md
```

## Deploying the contracts

```bash
pip install -r requirements.txt
python scripts/deploy.py --network studionet
```

See `scripts/deploy.py`'s module docstring for the Studio Next / studio-dev
path and the known fee-estimation edge case there.

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

See `frontend/README.md` for wallet behavior and how to point it at a
different network.

## Links

- GitHub: https://github.com/reza9133/SentinelGuard
- Twitter/X: https://x.com/amirhp771
