// lib/endpoints.js — the small hand-picked subset of GoldRush endpoints the
// demo wraps. GoldRush publishes 60+; these cover the three buckets the blog
// post highlights: Wallet Portfolio, Activity Feed, Pricing.
//
// chain names: GoldRush chain identifiers. For the Frontier (Solana) track:
//   solana-mainnet  (chain id 1399811149)
// EVM chains work too (base-mainnet, eth-mainnet, ...).

export const ENDPOINTS = {
  // Wallet Portfolio — token balances + USD value for an address.
  portfolio: {
    args: ["<chain>", "<address>"],
    bucket: "Wallet Portfolio",
    path: (chain, address) => `/v1/${chain}/address/${address}/balances_v2/`,
  },
  // Activity Feed — decoded transaction history for an address (page 0).
  activity: {
    args: ["<chain>", "<address>"],
    bucket: "Activity Feed",
    path: (chain, address) => `/v1/${chain}/address/${address}/transactions_v3/page/0/`,
  },
  // Pricing — historical USD price for a token contract.
  price: {
    args: ["<chain>", "<token>"],
    bucket: "Pricing",
    path: (chain, token) => `/v1/pricing/historical_by_addresses_v2/${chain}/USD/${token}/`,
  },
};
