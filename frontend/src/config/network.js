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
// -----------------------------------------------------------------------
import { studionet } from "genlayer-js/chains";

export const CHAIN = studionet;
export const NETWORK_NAME = "studionet";
export const IS_FEE_NETWORK = false;

export const CONTRACTS = {
  sentinelGuard: "0xdF396341809A2A3d1A4E1149D14FBdB5856BCD2E",
  demoVault: "0x5e04809a896C5e04D97406b955a9bFf725230239",
};

export const LINKS = {
  github: "https://github.com/reza9133/SentinelGuard",
  twitter: "https://x.com/amirhp771",
  genlayerDocs: "https://docs.genlayer.com",
};

export const BUILDER_NAME = "Amirhossein";
