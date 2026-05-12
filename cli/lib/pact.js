// lib/pact.js — the Pact (Solana) side of the integration.
//
// SIMULATED. No real network, no real signing, no real settlement. This stands
// in for `@q3labs/pact-insurance` talking to the Pact protocol program on Solana
// devnet (`5jBQb7fLz8FNSsHcc9qLzULDRNL5MkHbjjXMqZodwrU5`). The swap points are
// `quoteCoverage()`, `payCoverage()` and `refund()` — each would become a single
// call into the SDK. The settlement maths (premium formula, principal+premium
// refund) is real; only the chain I/O is faked.

// Static per-(provider,endpoint) reliability table. A live build reads this from
// the Pact public scorecard. Numbers are illustrative.
const RELIABILITY = {
  "goldrush:portfolio": 0.012,  // ELEVATED (1.2%)
  "goldrush:activity":  0.028,  // ELEVATED (2.8%)
  "goldrush:price":     0.004,  // RELIABLE (0.4%)
  _default:             0.015,
};

export function tierFor(failureRate) {
  if (failureRate < 0.01) return "RELIABLE";
  if (failureRate <= 0.05) return "ELEVATED";
  return "HIGH_RISK";
}

// Pact's published rate formula: max(0.001, failureRate * 1.5 + 0.001).
export function premiumFor(failureRate) {
  return Math.max(0.001, failureRate * 1.5 + 0.001);
}

export function quoteCoverage({ provider, endpoint, principalUsdc }) {
  const failureRate = RELIABILITY[`${provider}:${endpoint}`] ?? RELIABILITY._default;
  const premium = round6(premiumFor(failureRate));
  return {
    failureRate,
    tier: tierFor(failureRate),
    principal: round6(principalUsdc),
    premium,
    total: round6(principalUsdc + premium),
  };
}

// "Pay principal+premium into the Pact pool for this endpoint." SIMULATED.
export async function payCoverage(quote) {
  await delay(120);
  return {
    tx: b58(),
    settleBatchSeconds: 30 + Math.round(Math.random() * 30), // settler batches; ~30–60s
    simulated: true,
  };
}

// "Refund principal+premium to the agent." SIMULATED. Matches Pact's real
// policy: refunds return principal + premium; Pact earns only on success.
export async function refund(quote) {
  await delay(140);
  return {
    tx: b58(),
    refundTotal: round6(quote.principal + quote.premium),
    settleBatchSeconds: 30 + Math.round(Math.random() * 30),
    simulated: true,
  };
}

// --- helpers -----------------------------------------------------------------
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function round6(n) { return Math.round(n * 1e6) / 1e6; }
export function b58(n = 44) {
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = ""; for (let i = 0; i < n; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
