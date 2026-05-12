# pact pay goldrush

Pact Network coverage for Covalent GoldRush x402 data calls — **data-or-your-money-back for AI agents.**

GoldRush ships an x402 reverse proxy (`x402.goldrush.dev`) in front of `api.covalenthq.com`:
an agent calls a data endpoint with no API key, gets `402 Payment Required`, pays a USDC
micropayment on Base Sepolia, retries, gets data. Pact wraps that: the agent pays a small
*coverage* amount into a Pact pool **on Solana**, the Pact facilitator makes the GoldRush call
on the agent's behalf, a classifier decides success or failure, and on failure Pact refunds
**principal + premium**. Pact only earns on calls that returned good data.

Same composition as `pact pay curl <url>` in `../pact-pay-demo/`. Purely additive — nothing
in GoldRush or the upstream `pay` CLI changes.

Design contract & full JSON shape: **[`SPEC.md`](./SPEC.md)**.

## Run it

Node 20+. Zero runtime dependencies (uses `node:` builtins + global `fetch`).

```bash
# the 30-second side-by-side recording: baseline vs wrapped, one success, one refund
./demo.sh

# baseline — direct GoldRush call, agent eats the cost on failure
node bin/goldrush.js -v call portfolio solana-mainnet So11111111111111111111111111111111111111112

# wrapped — Pact coverage on Solana + refund on failed data
node bin/goldrush.js -v pact pay goldrush portfolio solana-mainnet So11111111111111111111111111111111111111112

# induced failure (unsupported chain) — watch the refund fire
node bin/goldrush.js -v pact pay goldrush portfolio solana-devnet So11111111111111111111111111111111111111112

# machine output only (the dashboard's input)
node bin/goldrush.js --json pact pay goldrush activity solana-mainnet So11111111111111111111111111111111111111112 | jq
```

### Endpoints (a hand-picked subset of GoldRush's 60+)

| alias       | bucket            | args                | GoldRush path |
|-------------|-------------------|---------------------|---------------|
| `portfolio` | Wallet Portfolio  | `<chain> <address>` | `/v1/{chain}/address/{address}/balances_v2/` |
| `activity`  | Activity Feed     | `<chain> <address>` | `/v1/{chain}/address/{address}/transactions_v3/page/0/` |
| `price`     | Pricing           | `<chain> <token>`   | `/v1/pricing/historical_by_addresses_v2/{chain}/USD/{token}/` |

`<chain>` takes GoldRush chain names. For the Frontier (Solana) track: `solana-mainnet`
(chain id `1399811149`). EVM chains (`base-mainnet`, `eth-mainnet`, …) work too. Passing an
unsupported chain is one of the demo's induced-failure cases.

### Flags

`-v/--verbose` (trail to stderr) · `--json` (machine line only) · `--force-fail` (induce an
upstream failure) · `--force-success` (force a green classification when there's no API key) ·
`-h/--help`.

## What's real, what's simulated

| piece | status |
|---|---|
| GoldRush x402 challenge (`GET x402.goldrush.dev/...`) | **real** — you'll see the real `402` + `payment-required` header |
| GoldRush data via API key (`GET api.covalenthq.com/...` with `GOLDRUSH_API_KEY`) | **real** |
| Paying the Base-Sepolia 402 | **not implemented** — `payViaX402()` in `lib/goldrush.js` is a one-line swap (needs a funded EVM key + `x402-fetch`) |
| Pact coverage payment + refund on Solana | **simulated & labelled** (`settlementSimulated: true`) — swap points are `payCoverage()` / `refund()` in `lib/pact.js`, which would call `@q3labs/pact-insurance` on devnet (program `5jBQb7fLz8FNSsHcc9qLzULDRNL5MkHbjjXMqZodwrU5`) |
| Classifier | **real** — runs against whatever body came back |
| Premium / tier maths | **real formula** (`max(0.001, failureRate*1.5 + 0.001)`), **static reliability table** (would come from the Pact scorecard) |

Bias, as instructed: **real GoldRush call + simulated Pact settlement.**

## Setup (optional)

- `GOLDRUSH_API_KEY` — a Covalent/GoldRush key → real data on `api.covalenthq.com`. Free
  14-day trial at [goldrush.dev](https://goldrush.dev). Without it the CLI hits the x402
  proxy and you'll see the real `402` (and, with no Base-Sepolia wallet wired in, the
  `payment_failed` path — which is itself a perfectly good demo of the refund flow).
- `PACT_OUT` — JSONL file every emitted row is appended to (default
  `./pact-goldrush-calls.jsonl`). This is what the dashboard reads. `demo.sh` truncates it
  at the start so each recording is clean.
- Base Sepolia faucet — only relevant once `payViaX402()` is implemented: faucet/bridge test
  USDC at `0x036CbD53842c5426634e7929541eC2318f3dCF7e` to an EVM key, set `EVM_PRIVATE_KEY`.

## Output shape

One JSON object per call on stdout (the human trail goes to stderr). Full field reference in
[`SPEC.md` §6](./SPEC.md). Short version:

```json
{ "id": "gr_…", "ts": "2026-05-12T…", "mode": "wrapped", "endpoint": "portfolio",
  "path": "/v1/solana-mainnet/address/…/balances_v2/", "chain": "solana-mainnet",
  "provider": "goldrush", "principal": 0.001, "premium": 0.019, "tier": "ELEVATED",
  "status": "refunded", "classification": "client_error", "refundTotal": 0.02,
  "upstreamLatencyMs": 312, "upstreamStatus": 400, "settlementTx": "okc2…5rt1",
  "settlementSimulated": true, "goldrushReal": true, "error": "request rejected 400" }
```
