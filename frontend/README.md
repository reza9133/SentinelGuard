# SentinelGuard — Frontend

A pure client-side React + Vite app for the SentinelGuard Intelligent
Contract (GenLayer, Autonomous Protocols track). No Next.js, no server —
everything talks directly to the chain from the browser via `genlayer-js`.

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL. `npm run build` produces a static `dist/`
folder deployable anywhere (Vercel, Netlify, GitHub Pages, IPFS).

## What's already verified

This project was built and **actually compiled with `npm run build`**
against the real, currently-published `genlayer-js` package (not just
written against the docs) — that caught two real API mismatches before
you'd have hit them at runtime:

- `isSuccessful` does not exist in the installed `genlayer-js` line; it's
  a v2 release-candidate addition for the Studio Next / consensus-v0.6
  preview only. `useSentinelClient.js` checks `statusName` +
  `txExecutionResultName` on the receipt directly instead.
- `waitForTransactionReceipt` in this line takes `status: "ACCEPTED"`,
  not a `waitUntil: "decided"` option (that's also a v2-only shape).

If you later point this app at Studio Next / studio-dev instead of
Studionet, you'll need the matching `genlayer-js` v2 RC package, and both
of the above will need to switch to the v2 shapes shown in the GenLayer
docs — `src/config/network.js` has a comment marking exactly what to
change.

## Configuration

Everything network- and contract-specific lives in one file:
**`src/config/network.js`** — chain object, `NETWORK_NAME`, the two
deployed addresses, and the GitHub/Twitter links in the footer.

The app currently targets **Studionet** (chain 61999, no fee deposit on
writes). If SentinelGuard is actually on Studio Next / studio-dev (chain
61997) instead, see the comment block at the top of `network.js`.

## Structure

```
src/
  config/network.js        chain + contract addresses + links
  hooks/useWallet.js        EIP-1193 connect/disconnect + auto network switch
  hooks/useSentinelClient.js  genlayer-js read/write wrappers
  lib/format.js              wei<->GEN, address formatting
  components/
    icons/    ShieldLogo, RadarSpinner, GenLayerMark, social icons
    layout/   Header, Footer
    ui/       Button, Badge, GlassCard
    sections/ Hero, HowItWorks, About, Dashboard, InteractionZone
  App.jsx
```

## Wallet behavior

- **Connect**: requests wallet permissions (forces the account picker,
  even on reconnect) then `eth_requestAccounts`, then prompts a network
  switch/add to the configured chain.
- **Disconnect**: clears local React state only — MetaMask itself has no
  programmatic disconnect. Clicking Connect again re-opens the wallet's
  own account picker, so a different account can be chosen.
- Reads (the Dashboard, target lookups) work with **no wallet connected**
  at all, via a separate account-free `genlayer-js` client.
