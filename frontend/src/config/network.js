// -----------------------------------------------------------------------
// Network configuration
// -----------------------------------------------------------------------
// This app targets Studionet (genlayer-js/chains "studionet", chain id
// 61999) - the stable, hosted GenLayer network with no fee deposit on
// writes, which is why writeContract() calls in this app never build a
// `fees` object.
//
// If SentinelGuard was actually deployed to Studio Next / studio-dev
// (chain id 61997) instead, change the two lines below to import the
// matching release-candidate chain object (its export name follows the
// installed genlayer-js RC, typically `studioDevnet`) and set
// IS_FEE_NETWORK to true - then every write in useSentinelClient.js needs
// a `fees` estimate first (see the reference implementation in
// scripts/deploy.py in the contracts repo for the exact estimate shape).
//
// IMPORTANT: the addresses below are placeholders. The contract's storage
// layout changed (registration/rulebook authorization, hook grace-period
// reconciliation, per-reporter incident index), so any previous deployment
// is NOT compatible - redeploy with `python3 scripts/deploy.py` first and
// copy the resulting `sentinel_guard` / `demo_vault` addresses from the
// generated deployed.<network>.json here before running the app.
// -----------------------------------------------------------------------
import { studionet } from "genlayer-js/chains";

export const CHAIN = studionet;
export const NETWORK_NAME = "studionet";
export const IS_FEE_NETWORK = false;

export const CONTRACTS = {
  sentinelGuard: "0x0000000000000000000000000000000000000000", // TODO: set after redeploy
  demoVault: "0x0000000000000000000000000000000000000000", // TODO: set after redeploy
};

export const LINKS = {
  github: "https://github.com/reza9133/SentinelGuard",
  twitter: "https://x.com/amirhp771",
  genlayerDocs: "https://docs.genlayer.com",
};

export const BUILDER_NAME = "Amirhossein";
