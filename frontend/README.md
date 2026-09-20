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
  config/network.js            chain + contract addresses + links
  hooks/useWallet.js           wallet state: EIP-6963 discovery, connect,
                               disconnect, switch account / network, modal state
  hooks/useSentinelClient.js   genlayer-js read/write wrappers (signs with the
                               wallet picked in the modal)
  lib/eip6963.js               wallet discovery + the active-provider registry
  lib/format.js                wei<->GEN, address formatting
  components/
    icons/     ShieldLogo, RadarSpinner, GenLayerMark, social icons
    layout/    Header, Footer
    ui/        Button, Badge, GlassCard
    wallet/    AccountPanel (header control + modals), Modal,
               WalletPickerList, AddressDisplay, icons
    sections/  Hero, HowItWorks, About, Dashboard, InteractionZone
  App.jsx
```

The wallet UI needs no extra dependencies: the modal and its icons are local
(`components/wallet/`) and animate with the `framer-motion` the app already
uses. The modal renders through a portal into `<body>` on purpose — the sticky
header uses `backdrop-filter`, which would otherwise clip a `position: fixed`
child to the header instead of covering the screen.

## Wallet behavior

- **Wallet picker**: *Connect wallet* opens a modal listing every wallet that
  announces itself through EIP-6963 (MetaMask, Rabby, OKX, Coinbase…), so the
  person chooses which one to use instead of whichever grabbed
  `window.ethereum`. Older wallets without EIP-6963 fall back to a single
  *Connect wallet* button that uses `window.ethereum`; with no wallet at all
  the modal shows an install prompt.
- **Connect**: `eth_requestAccounts` on the chosen wallet, then a network
  switch/add to the configured chain (Studionet). A rejected or failed switch
  never drops the connection — the header chip turns amber and the wallet
  details modal offers a *Switch network* button.
- **Signing**: transactions are signed by the wallet that was picked, not
  whichever one owns `window.ethereum` (`useSentinelClient` reads the active
  provider from `lib/eip6963.js`).
- **Wallet details** (click the address chip in the header): full address with
  copy, the connected wallet's name, the reporter's on-chain trust score
  (`reporter_trust`, hidden if the read fails), network status, *Switch
  account*, and *Disconnect*.
- **Switch account**: `wallet_requestPermissions`, which opens the wallet's own
  account picker even while already connected.
- **Disconnect**: calls `wallet_revokePermissions` where the wallet supports
  it, so the next connect shows a real consent prompt instead of silently
  re-approving the same account; then forgets the selected wallet. Wallets
  without revocation still disconnect locally — they just won't force a fresh
  prompt.
- **Remembered between visits**: the picked wallet is stored in
  `localStorage` (`sentinelguard_wallet_rdns`) and reconnected on the next
  load via `eth_accounts` — no popup, and only if the wallet already granted
  access. After an intentional disconnect (`sentinelguard_wallet_disconnected`)
  the app stays disconnected until the person connects again.
- Reads (the Dashboard, target lookups) work with **no wallet connected**
  at all, via a separate account-free `genlayer-js` client.
