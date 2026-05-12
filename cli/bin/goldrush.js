#!/usr/bin/env node
// pact pay goldrush — Pact Network × Covalent GoldRush.
//
//   baseline:  node bin/goldrush.js call <endpoint> <args...>
//   wrapped:   node bin/goldrush.js pact pay goldrush <endpoint> <args...>
//
// Real GoldRush call (x402.goldrush.dev, or api.covalenthq.com with
// GOLDRUSH_API_KEY). Pact coverage payment + refund on Solana is SIMULATED and
// labelled (settlementSimulated: true). See SPEC.md.
//
// Every invocation prints exactly one JSON line on STDOUT (the dashboard's
// input). The human trail (-v) goes to STDERR so `--json | jq` stays clean.

import fs from "node:fs";
import { resolveEndpoint, callGoldRush } from "../lib/goldrush.js";
import { classify } from "../lib/classify.js";
import { quoteCoverage, payCoverage, refund } from "../lib/pact.js";

const argv = process.argv.slice(2);

// flags (accepted from anywhere)
const F = (name) => argv.includes(name);
const wantHelp      = F("-h") || F("--help");
const verbose       = F("-v") || F("--verbose");
const jsonOnly      = F("--json");
const forceFail     = F("--force-fail");
const forceSuccess  = F("--force-success");
const positional = argv.filter((a) => !a.startsWith("-"));

// dispatch
let mode, alias, args;
if (positional[0] === "pact" && positional[1] === "pay" && positional[2] === "goldrush") {
  mode = "wrapped"; alias = positional[3]; args = positional.slice(4);
} else if (positional[0] === "call") {
  mode = "baseline"; alias = positional[1]; args = positional.slice(2);
} else {
  mode = null;
}

if (wantHelp || !mode || !alias) {
  process.stdout.write(`pact pay goldrush — Pact Network coverage for GoldRush x402 data calls

usage:
  node bin/goldrush.js call <endpoint> <args...>                 baseline — direct GoldRush call (agent eats the cost on failure)
  node bin/goldrush.js pact pay goldrush <endpoint> <args...>    Pact-wrapped — coverage on Solana + refund on failed data

endpoints:
  portfolio  <chain> <address>    Wallet Portfolio  -> /v1/{chain}/address/{address}/balances_v2/
  activity   <chain> <address>    Activity Feed     -> /v1/{chain}/address/{address}/transactions_v3/page/0/
  price      <chain> <token>      Pricing           -> /v1/pricing/historical_by_addresses_v2/{chain}/USD/{token}/

  <chain> e.g. solana-mainnet (Frontier track), base-mainnet, eth-mainnet

flags:
  -v, --verbose       print the payment + retry + settlement trail (to stderr)
  --json              emit only the machine JSON line
  --force-fail        induce an upstream failure (demo: shows the refund path)
  --force-success     force a successful classification when there's no API key (demo)
  -h, --help

env:
  GOLDRUSH_API_KEY    optional — real GoldRush data via api.covalenthq.com (else: x402.goldrush.dev, real 402)
  PACT_OUT            optional — JSONL file to append every emitted row to (default ./pact-goldrush-calls.jsonl)

Pact coverage on Solana is SIMULATED in this CLI (clearly labelled). Real GoldRush calls.
learn more: https://pactnetwork.io  ·  https://goldrush.dev
`);
  process.exit(wantHelp ? 0 : 2);
}

// --- colours / formatting (trail to stderr) ----------------------------------
const isTTY = process.stderr.isTTY;
const c = isTTY ? {
  dim: (s) => `\x1b[2m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m`,
} : new Proxy({}, { get: () => (s) => `${s}` });
const PACT = c.cyan("[pact]");
const GR   = c.yellow("[goldrush]");
const trail = (...a) => { if (verbose && !jsonOnly) process.stderr.write(a.join(" ") + "\n"); };
const usd = (n) => n.toFixed(n < 0.01 ? 4 : 3);
const short = (s) => (s && s.length > 9 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s);
const ulid = () => "gr_" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();

(async () => {
  const id = ulid();
  const ts = new Date().toISOString();

  // resolve the endpoint (this is also where bad-chain / missing-arg failures surface)
  let ep;
  try {
    ep = resolveEndpoint(alias, args);
  } catch (e) {
    return emit({
      id, ts, mode, endpoint: alias, path: null, chain: args[0] || null, provider: "goldrush",
      principal: 0, premium: 0, tier: null, status: "refunded", classification: "client_error",
      refundTotal: 0, upstreamLatencyMs: 0, upstreamStatus: null, settlementTx: null,
      settlementSimulated: true, goldrushReal: false, error: e.message,
    }, /*hardFail*/ true, e.message);
  }

  trail("");
  trail(c.bold(mode === "wrapped" ? "pact pay goldrush " + alias : "goldrush call " + alias),
        c.dim(`(${ep.bucket} · ${ep.chain})`));
  trail(c.dim("GET https://" + (process.env.GOLDRUSH_API_KEY ? "api.covalenthq.com" : "x402.goldrush.dev") + ep.path));

  // --- wrapped: quote + pay coverage on Solana (SIMULATED) -------------------
  let quote = null, coverageTx = null;
  if (mode === "wrapped") {
    // we need a principal to quote; use the endpoint's known price (refined
    // below if the 402 tells us a different amount)
    const provisional = await callPricePeek(ep);
    quote = quoteCoverage({ provider: "goldrush", endpoint: alias, principalUsdc: provisional });
    trail(`${PACT} quote: principal ${usd(quote.principal)} USDC + premium ${usd(quote.premium)} USDC`,
          c.dim(`(tier=${quote.tier}, failureRate=${(quote.failureRate * 100).toFixed(1)}%)`));
    const pay = await payCoverage(quote);
    coverageTx = pay.tx;
    trail(`${PACT} coverage paid on Solana: ${short(pay.tx)}`,
          c.dim(`(settle_batch ~${pay.settleBatchSeconds}s · ${pay.simulated ? "SIMULATED" : "on-chain"})`));
    trail(`${PACT} facilitator side-calls GoldRush on the agent's behalf…`,
          c.dim("(chain seam handled here — agent only touched Solana)"));
  } else {
    trail(c.dim("(no coverage — baseline; agent eats the cost on failure)"));
  }

  // --- the actual GoldRush call ---------------------------------------------
  const call = await callGoldRush({
    path: ep.path, alias, forceFail,
    forceSuccess: forceSuccess && mode === "wrapped",
  });
  const principal = quote ? Math.max(quote.principal, call.principalUsdc || 0) : (call.principalUsdc || 0);
  if (quote && principal !== quote.principal) {
    // 402 told us a different amount — re-quote against it
    quote = quoteCoverage({ provider: "goldrush", endpoint: alias, principalUsdc: principal });
  }

  if (call.transportError) {
    trail(`${GR} transport error: ${c.red(call.transportError)}`, c.dim(`(${call.latencyMs}ms)`));
  } else {
    const sc = call.httpStatus >= 200 && call.httpStatus < 300 ? c.green(call.httpStatus)
             : call.httpStatus === 402 ? c.yellow("402 Payment Required")
             : c.red(call.httpStatus);
    trail(`${GR} HTTP ${sc}`, c.dim(`(${call.latencyMs}ms${call.goldrushReal ? "" : ", simulated body"})`));
    if (call.paymentRequired) {
      const a = call.paymentRequired;
      trail(`${GR} ${c.dim(`x402: pay ${a.amountUsdc} ${a.raw?.accepts?.[0]?.extra?.name || "USDC"} on ${a.network} to ${short(a.payTo)}`)}`);
    }
  }

  // --- classify --------------------------------------------------------------
  const verdict = classify(call);
  const vc = verdict.classification === "success" ? c.green("success") : c.red(verdict.classification);
  trail(`${PACT} classifier: ${vc}`, c.dim(`(${verdict.reason})`));

  // --- settle ----------------------------------------------------------------
  let status, refundTotal = 0, settlementTx = coverageTx;
  if (mode === "wrapped") {
    trail(`${PACT} policy: ${c.bold(verdict.refund ? "refund_on_failed_data" : "release_to_provider")}`);
    if (verdict.refund) {
      const r = await refund(quote);
      status = "refunded"; refundTotal = r.refundTotal; settlementTx = r.tx;
      trail(`${PACT} ${c.bold("refund")} ${usd(refundTotal)} USDC -> agent: ${short(r.tx)}`,
            c.dim(`(settle_batch ~${r.settleBatchSeconds}s · ${r.simulated ? "SIMULATED" : "on-chain"})`));
      trail(`${PACT} ${c.dim("principal + premium both refunded — Pact net $0.000 on this call")}`);
      trail(c.dim(`${PACT} https://explorer.solana.com/tx/${r.tx}?cluster=devnet  (simulated)`));
    } else {
      status = "settled";
      trail(`${PACT} settled: GoldRush receives ${usd(quote.principal)} USDC, Pact keeps premium ${usd(quote.premium)} USDC`);
    }
  } else {
    // baseline: nothing is refundable. On failure the agent is just out of pocket.
    status = "settled"; // "settled" here means "no coverage, money's gone either way"
    if (verdict.refund) {
      trail(`${c.red("[baseline]")} no coverage — agent paid for the call and got ${verdict.classification}; ${c.bold("nothing refunded")}.`);
    } else {
      trail(`${c.dim("[baseline]")} call succeeded; agent paid ${usd(principal)} USDC for the data.`);
    }
  }
  trail("");

  emit({
    id, ts, mode, endpoint: alias, path: ep.path, chain: ep.chain, provider: "goldrush",
    principal: round6(principal),
    premium: quote ? round6(quote.premium) : 0,
    tier: quote ? quote.tier : null,
    status,
    classification: verdict.classification,
    refundTotal: round6(refundTotal),
    upstreamLatencyMs: call.latencyMs,
    upstreamStatus: call.httpStatus,
    settlementTx: mode === "wrapped" ? settlementTx : null,
    settlementSimulated: true,
    goldrushReal: !!call.goldrushReal,
    ...(verdict.refund ? { error: verdict.reason } : {}),
  });
})().catch((e) => {
  process.stderr.write(`\nfatal: ${e && e.stack ? e.stack : e}\n`);
  process.exit(1);
});

// --- emit: one JSON line to stdout (+ append to PACT_OUT) --------------------
function emit(row, hardFail = false, errMsg = null) {
  const line = JSON.stringify(row);
  process.stdout.write(line + "\n");
  const out = process.env.PACT_OUT || "./pact-goldrush-calls.jsonl";
  try { fs.appendFileSync(out, line + "\n"); } catch { /* non-fatal */ }
  if (hardFail) { if (verbose && !jsonOnly) process.stderr.write(c.red(`error: ${errMsg}\n`)); process.exit(1); }
}

function round6(n) { return Math.round(n * 1e6) / 1e6; }

// price peek: best-effort principal estimate before the call, for the quote.
async function callPricePeek(ep) {
  // We don't make a network call here; use the per-endpoint stand-in price.
  // (The 402 path will re-quote against the real amount once we see it.)
  const { ENDPOINTS } = await import("../lib/endpoints.js");
  void ENDPOINTS; // endpoints don't carry price; pricing lives in lib/goldrush.js
  const map = { portfolio: 0.0010, activity: 0.0010, price: 0.0005 };
  return map[ep.alias] ?? 0.001;
}
