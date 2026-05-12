# `pact pay goldrush` — integration design

> Pact Network × Covalent GoldRush. Frontier (Solana) side-track, "Build with GoldRush".
> This document is the design contract. Read it before the code.

## 1. The idea in one paragraph

GoldRush ships an x402 reverse proxy (`x402.goldrush.dev`) in front of `api.covalenthq.com`:
an agent calls a data endpoint with no API key, gets `402 Payment Required`, pays a USDC
micropayment on Base Sepolia, retries, gets data. That works — until the call fails (bad
address, unsupported chain, upstream 5xx, timeout, garbage body). The agent already paid.
Pact wraps that call: the agent pays a small *coverage* amount into a Pact pool **on Solana**,
the Pact facilitator makes the GoldRush call on the agent's behalf, a classifier decides
success or failure, and on failure Pact refunds **principal + premium**. Pact only earns the
premium on calls that actually returned good data. Same composition as `pact pay curl <url>`
in `../pact-pay-demo/` — additive, nothing in GoldRush or the upstream `pay` CLI changes.

## 2. CLI surface

```
# baseline — direct GoldRush call, agent eats the cost on failure
node bin/goldrush.js call <endpoint> <args...>

# wrapped — Pact coverage around the same call
node bin/goldrush.js pact pay goldrush <endpoint> <args...>

# flags (either form)
-v, --verbose      print the payment + retry + settlement trail
--json             emit only the machine JSON line (no human trail)
--force-fail       induce an upstream failure (demo: shows the refund path)
--force-success    force a successful classification (demo)
-h, --help
```

### Endpoints (a small, hand-picked subset of GoldRush's 60+)

| alias        | GoldRush path                                                              | args              | "portfolio / activity / pricing" bucket |
|--------------|-----------------------------------------------------------------------------|-------------------|------------------------------------------|
| `portfolio`  | `/v1/{chain}/address/{address}/balances_v2/`                                | `<chain> <address>` | Wallet Portfolio |
| `activity`   | `/v1/{chain}/address/{address}/transactions_v3/page/0/`                     | `<chain> <address>` | Activity Feed |
| `price`      | `/v1/pricing/historical_by_addresses_v2/{chain}/USD/{contractAddress}/`     | `<chain> <token>`   | Pricing |

`<chain>` accepts GoldRush chain names — for the Frontier track that is `solana-mainnet`
(chain id `1399811149`). EVM chains (`base-mainnet`, `eth-mainnet`, …) work too; passing an
unknown chain is one of the induced-failure cases.

## 3. Flow — baseline vs wrapped

### Baseline (`call`)
1. Resolve endpoint → URL.
2. If `GOLDRUSH_API_KEY` is set → `GET api.covalenthq.com{path}` with `Authorization: Bearer <key>` — **real GoldRush data**.
   Else → `GET x402.goldrush.dev{path}` with no key — **real GoldRush x402 challenge** (`402` + `payment-required` header). Without a Base-Sepolia wallet wired in, the agent cannot complete the payment from this CLI, so this is treated as "agent paid nothing but also got nothing" — the baseline-failure case.
3. Whatever happens, print it. On failure the agent is out of pocket (in the real x402 path, out the USDC it spent paying the 402 before the upstream errored). No refund. That's the point.

### Wrapped (`pact pay goldrush`)
1. **Quote.** Pact prices coverage from the provider's observed reliability tier (RELIABLE / ELEVATED / HIGH_RISK — same tiers as `@q3labs/pact-monitor`). `premium = max(0.001, failureRate * 1.5 + 0.001)` USDC. `principal` = the GoldRush call price (the x402 amount, or the credit cost mapped to USDC).
2. **Pay coverage on Solana.** The agent pays `principal + premium` into the Pact coverage pool for that endpoint. *In this CLI this is simulated* (b58 tx id, "settle_batch" lag) and clearly labelled — wiring to the devnet `pact-monitor` backend (`@q3labs/pact-insurance`, program `5jBQb7fLz8FNSsHcc9qLzULDRNL5MkHbjjXMqZodwrU5`) is a one-call swap, left out for the timeline. **Bias chosen: real GoldRush call, simulated Pact settlement.**
3. **Facilitator side-calls GoldRush.** This is where the chain seam lives: the agent only ever touched Solana; the facilitator reaches GoldRush either via a funded Covalent API key (`api.covalenthq.com`, used here when `GOLDRUSH_API_KEY` is set → real data) or via GoldRush's Base x402 proxy (`x402.goldrush.dev`, the Base USDC payment being an internal implementation detail invisible to the agent). Native Base settlement for Pact itself is out of scope.
4. **Classify.** See §4.
5. **Settle.**
   - success → Pact keeps the premium, releases the principal to GoldRush's payee. Status `settled`.
   - failure → Pact refunds `principal + premium` to the agent. Status `refunded`, `refundTotal = principal + premium`. Pact net $0.000 on this call.
6. **Print the trail** (`-v`) and **emit the JSON line** (always; alone with `--json`).

## 4. Success / failure classifier

Mirrors the monitor SDK's outcome model (`ok` / `client_error` / `server_error`) plus a body
check, because "200 with a useless body" is a real GoldRush failure mode (e.g. an empty
`items` array where the wallet does have history, or `data: null`).

| condition                                                              | classification   | refund? |
|------------------------------------------------------------------------|------------------|---------|
| transport error / DNS / connection reset / timeout (> `TIMEOUT_MS`)    | `timeout`        | yes     |
| HTTP 5xx                                                               | `server_error`   | yes     |
| HTTP 402 not satisfiable (no wallet, wrong tier)                       | `payment_failed` | yes     |
| HTTP 4xx other (incl. bad/unknown chain → 404, bad address → 400)      | `client_error`   | yes     |
| HTTP 200, body parses, GoldRush `error: true` or `error_code` present  | `provider_error` | yes     |
| HTTP 200, body parses, but `data` missing / `data.items` not an array  | `schema_error`   | yes     |
| HTTP 200, body parses, schema OK                                       | `success`        | **no**  |

Refund policy id used in the trail: `refund_on_failed_data` (umbrella). Pact's stance: the
agent paid for *data*; anything that isn't usable data is refundable.

> Note on `client_error`: in the production monitor SDK a 4xx is "your fault, no refund". For
> this *retail coverage product* we refund 4xx too — the agent's intent was "get me this
> wallet's portfolio"; a malformed-address rejection still left them with no data and a spent
> coverage payment. This is a product decision, not a bug; called out so reviewers see it.

## 5. Premium / refund accounting

- `principal` — what GoldRush charges for the call. From the x402 `amount` (Base Sepolia
  USDC, 6 decimals → `100` ⇒ `0.0001` USDC) when using the proxy, or a fixed per-endpoint
  USDC price when using the API-key path (portfolio `0.0010`, activity `0.0010`, price
  `0.0005` — round numbers standing in for GoldRush credits). All amounts in USDC, 3 dp in
  the human trail, full precision in JSON.
- `premium` — `max(0.001, failureRate * 1.5 + 0.001)`. Tier comes from `failureRate`:
  `< 0.01` RELIABLE, `0.01–0.05` ELEVATED, `> 0.05` HIGH_RISK. The CLI carries a tiny static
  reliability table per (provider, endpoint); a live build would read it from the Pact
  scorecard.
- **settled:** agent paid `principal + premium`; GoldRush receives `principal`; Pact keeps
  `premium`. `refundTotal = 0`.
- **refunded:** agent paid `principal + premium`; agent receives `principal + premium` back;
  GoldRush receives `0`; Pact keeps `0`. `refundTotal = principal + premium`. Matches Pact's
  real policy (refunds return principal + premium; Pact earns only on successful calls).

## 6. Emitted JSON (one line per call, stdout)

Every invocation (baseline and wrapped) prints exactly one JSON object on its own line. The
human trail (when `-v`) goes to **stderr** so `--json | jq` stays clean; with `--json` the
trail is suppressed entirely.

```json
{
  "id": "gr_01HZ…",            // ulid-ish; stable per call
  "ts": "2026-05-12T09:00:00.000Z",
  "mode": "wrapped",            // "baseline" | "wrapped"
  "endpoint": "portfolio",      // alias from the table above
  "path": "/v1/solana-mainnet/address/So111…/balances_v2/",
  "chain": "solana-mainnet",
  "provider": "goldrush",
  "principal": 0.001,           // USDC
  "premium": 0.0017,            // USDC; 0 in baseline mode
  "tier": "ELEVATED",           // RELIABLE | ELEVATED | HIGH_RISK; null in baseline
  "status": "settled",          // "settled" | "refunded"  (baseline: "settled" on ok, "refunded" is never emitted — see below)
  "classification": "success",  // success | timeout | server_error | client_error | payment_failed | provider_error | schema_error
  "refundTotal": 0,             // USDC; principal+premium when refunded, else 0
  "upstreamLatencyMs": 412,
  "upstreamStatus": 200,        // HTTP status of the GoldRush call (null on transport error)
  "settlementTx": "5xK…",       // Solana tx id for the coverage payment / refund (simulated)
  "settlementSimulated": true,  // honesty flag — false once wired to devnet
  "goldrushReal": true,         // true when the GoldRush call actually hit the network
  "error": "bad chain name: solana-devnet"   // present only on failure
}
```

Baseline-mode rows: `mode: "baseline"`, `premium: 0`, `tier: null`, `settlementTx: null`,
`refundTotal: 0`. On failure baseline still reports `status: "settled"` with the failure
`classification` and an `error` — because in baseline land **nothing gets refunded**; the
dashboard renders these as red rows with "no coverage". (The dashboard distinguishes by
`mode`, not by inventing a fake refund.)

This shape is the dashboard's input — append one line per call to a JSONL file and the
dashboard reads it.

## 7. What is real vs simulated (honesty box)

| piece                          | status in this CLI                                                    |
|--------------------------------|-----------------------------------------------------------------------|
| GoldRush x402 challenge        | **real** — `GET x402.goldrush.dev/...` returns the real `402` + `payment-required` header |
| GoldRush data (API-key path)   | **real** — `GET api.covalenthq.com/...` with `GOLDRUSH_API_KEY`       |
| Paying the Base-Sepolia 402    | **not done** — needs a funded EVM wallet + x402 client; structured as a one-line swap (`payViaX402()` stub in `lib/goldrush.js`) |
| Pact coverage payment (Solana) | **simulated** — b58 tx id, settle-batch lag; swap point is `lib/pact.js`'s `payCoverage()` / `refund()` (would call `@q3labs/pact-insurance` on devnet) |
| Classifier                     | **real** — runs against whatever body came back                       |
| Premium / tier maths           | **real formula**, **static reliability table** (would come from the Pact scorecard) |

## 8. Setup (for the README, summarised)

- Node 20+. Zero runtime deps (uses `node:` builtins + global `fetch`).
- `GOLDRUSH_API_KEY` (optional) — a Covalent/GoldRush key → real data on `api.covalenthq.com`.
  Free 14-day trial at goldrush.dev. Without it the CLI uses the x402 proxy and you'll see the
  real `402` (and, with no wallet, the `payment_failed` path — which is a perfectly good demo
  of the refund flow).
- `PACT_OUT` (optional) — path to a JSONL file to append every emitted row to (default
  `./pact-goldrush-calls.jsonl`). This is what the dashboard reads.
- Base Sepolia faucet (only if/when `payViaX402()` is implemented): bridge or faucet test
  USDC at `0x036CbD53842c5426634e7929541eC2318f3dCF7e` to an EVM key, set `EVM_PRIVATE_KEY`.
