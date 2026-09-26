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
// Deployed to studionet (chain 61999) - matches deployed.studionet.json.
// -----------------------------------------------------------------------
import { studionet } from "genlayer-js/chains";

export const CHAIN = studionet;
export const NETWORK_NAME = "studionet";
export const IS_FEE_NETWORK = false;

export const CONTRACTS = {
  sentinelGuard: "0x623D42db647b66E4d8152d6a9C90937CeAD3a21d",
  demoVault: "0x85dAf1A80AC8734a0f4236B03775332026739485",
};

export const LINKS = {
  github: "https://github.com/reza9133/SentinelGuard",
  twitter: "https://x.com/amirhp771",
  genlayerDocs: "https://docs.genlayer.com",
};

export const BUILDER_NAME = "Amirhossein";
