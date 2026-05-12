// lib/goldrush.js — the GoldRush side of the integration.
//
// Two ways to reach GoldRush:
//   1. API-key path  -> GET api.covalenthq.com/...  (Authorization: Bearer <key>)  — REAL DATA
//   2. x402 path     -> GET x402.goldrush.dev/...   (no key) — REAL 402 CHALLENGE
//
// Paying the Base-Sepolia 402 from this CLI is intentionally left as a one-line
// swap: `payViaX402()` below. Wiring it needs a funded EVM key + an x402 client
// (`x402-fetch` / `@x402/core` with the `exact` scheme). Until then the x402
// path stops at the 402 and the wrapper classifies it as `payment_failed`
// (which still exercises the refund path — fine for the demo).

import { ENDPOINTS } from "./endpoints.js";

const API_HOST  = "https://api.covalenthq.com";
const X402_HOST = "https://x402.goldrush.dev";

// USDC price (stand-in for GoldRush credits) per endpoint on the API-key path.
const API_PRICE_USDC = { portfolio: 0.0010, activity: 0.0010, price: 0.0005 };

export function resolveEndpoint(alias, args) {
  const def = ENDPOINTS[alias];
  if (!def) {
    const list = Object.keys(ENDPOINTS).join(", ");
    throw new Error(`unknown endpoint "${alias}" — try one of: ${list}`);
  }
  if (args.length < def.args.length) {
    throw new Error(`endpoint "${alias}" needs ${def.args.length} arg(s): ${def.args.join(" ")}`);
  }
  const [chain, second] = args;
  // basic shape checks — these are also some of the induced-failure cases
  if (!chain) throw new Error("missing <chain>");
  return { alias, chain, path: def.path(chain, second), bucket: def.bucket };
}

// Parse the x402 `payment-required` header (base64 JSON) into something readable.
export function parsePaymentRequired(headerB64) {
  try {
    const json = JSON.parse(Buffer.from(headerB64, "base64").toString("utf8"));
    const a = (json.accepts && json.accepts[0]) || {};
    // amount is in the asset's smallest unit; USDC = 6 decimals.
    const amountUsdc = a.amount != null ? Number(a.amount) / 1e6 : null;
    return {
      x402Version: json.x402Version,
      scheme: a.scheme,
      network: a.network,         // e.g. "eip155:84532" — Base Sepolia
      asset: a.asset,             // Base Sepolia USDC contract
      payTo: a.payTo,
      amountUsdc,
      raw: json,
    };
  } catch {
    return null;
  }
}

// --- the actual GoldRush call -------------------------------------------------
//
// Returns: { ok, httpStatus, latencyMs, body, paymentRequired, principalUsdc,
//            goldrushReal, transportError }
export async function callGoldRush({ path, alias, timeoutMs = 8000, forceFail = false, forceSuccess = false }) {
  const apiKey = process.env.GOLDRUSH_API_KEY;
  const t0 = Date.now();

  // Demo overrides — induce outcomes without touching the network.
  if (forceFail) {
    return {
      ok: false, httpStatus: 503, latencyMs: 1180 + Math.floor(Math.random() * 200),
      body: { error: true, error_message: "induced upstream failure (--force-fail)", error_code: 503, data: null },
      paymentRequired: null, principalUsdc: priceFor(alias, null), goldrushReal: false, transportError: null,
    };
  }

  const url = apiKey ? `${API_HOST}${path}` : `${X402_HOST}${path}`;
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
                         : { Accept: "application/json" };

  let resp, transportError = null;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    resp = await fetch(url, { headers, signal: ac.signal });
    clearTimeout(timer);
  } catch (e) {
    transportError = e && e.name === "AbortError" ? "timeout" : (e && e.message) || String(e);
    return {
      ok: false, httpStatus: null, latencyMs: Date.now() - t0, body: null,
      paymentRequired: null, principalUsdc: priceFor(alias, null), goldrushReal: true, transportError,
    };
  }

  const latencyMs = Date.now() - t0;
  let body = null;
  const text = await resp.text();
  try { body = JSON.parse(text); } catch { body = { _nonJson: text.slice(0, 200) }; }

  let paymentRequired = null;
  if (resp.status === 402) {
    const h = resp.headers.get("payment-required") || resp.headers.get("Payment-Required");
    if (h) paymentRequired = parsePaymentRequired(h);
    // The agent could now pay via payViaX402() and retry; not implemented here.
  }

  const principalUsdc = paymentRequired?.amountUsdc ?? priceFor(alias, null);

  // Optional forced-success override for the demo's "happy" wrapped call when
  // there's no API key (so we don't depend on a live key for the green path).
  if (forceSuccess && !apiKey) {
    return {
      ok: true, httpStatus: 200, latencyMs: 380 + Math.floor(Math.random() * 120),
      body: { data: { address: pathAddress(path), items: [{ contract_ticker_symbol: "SOL", balance: "1500000000", quote: 234.12 }] }, error: false },
      paymentRequired: null, principalUsdc, goldrushReal: false, transportError: null,
    };
  }

  return {
    ok: resp.status >= 200 && resp.status < 300,
    httpStatus: resp.status, latencyMs, body, paymentRequired, principalUsdc,
    goldrushReal: true, transportError: null,
  };
}

// --- the one-line swap: actually pay the Base-Sepolia 402 --------------------
// Implement with `x402-fetch` (wrap fetch, give it an EVM signer funded with
// Base Sepolia USDC at 0x036CbD53842c5426634e7929541eC2318f3dCF7e) and re-issue
// the GET. Left intentionally as a stub — see SPEC §7.
export async function payViaX402(_paymentRequired, _url) {
  throw new Error("payViaX402: not implemented — wire x402-fetch + a funded Base Sepolia EVM key");
}

function priceFor(alias) { return API_PRICE_USDC[alias] ?? 0.001; }
function pathAddress(path) {
  const m = path.match(/address\/([^/]+)\//); return m ? m[1] : "unknown";
}
