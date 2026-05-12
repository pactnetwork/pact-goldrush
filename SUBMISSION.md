# Pact × GoldRush — data-or-your-money-back for agent data calls

**Track:** Build with GoldRush (Frontier / Solana side track), Superteam Earn — https://superteam.fun/earn/listing/build-with-goldrush-track-powered-by-covalent
**Team:** Pact Network
**Repo:** https://github.com/pactnetwork/pact-goldrush
**Demo video:** _[TODO: link]_
**Pact mainnet program:** `5bCJcdWdK...` (Solana mainnet) · https://pactnetwork.io

---

## What it is

Pact gives a GoldRush x402 data call a refund guarantee. An agent runs `pact pay goldrush <endpoint>` instead of calling GoldRush directly: it pays the call's price plus a small premium into a Pact coverage pool on Solana, Pact's facilitator makes the GoldRush call on the agent's behalf, a classifier checks whether the response actually arrived and looks like real data, and if the call failed or the body is garbage, Pact refunds the principal and the premium. Pact only keeps the premium when the call worked. GoldRush doesn't have to do anything — the wrapper sits next to their API, not inside it.

## The problem

x402 makes a data call a payment. That's the whole point — an agent can buy a Wallet Portfolio lookup for a few cents without an account or an API key. But a payment that settles instantly and irreversibly has no recourse attached. If GoldRush's upstream times out, returns a 500, or the body comes back truncated or empty, the agent already paid. There's no chargeback, no dispute window, no "try again for free." A human who buys something broken calls Visa. An agent that buys something broken eats it.

That's fine when an agent is spending $0.31 on one call. It stops being fine the moment an agent operator wants to uncap a budget and run thousands of data calls a day. The failure rate doesn't have to be high — a median production API runs around a 0.5% error rate — for "no recourse" to be the reason a finance team won't sign off. The data is good. The payment rail is missing a piece.

## What we built

This repo:

1. **`pact pay goldrush` — the wrapper CLI** (`cli/`). Zero dependencies, Node 20+. It wraps a GoldRush call in a Pact coverage flow. The demo shows two paths side by side:
   - **baseline** (`goldrush call <endpoint> <chain> <address>`): a direct GoldRush x402 call. The CLI hits `x402.goldrush.dev`, gets a real `402 Payment Required` back, and — since nothing paid the 402 — the agent is left with `payment_failed` and nothing. (With a Covalent API key set, the same path returns real data from `api.covalenthq.com`.)
   - **wrapped** (`pact pay goldrush <endpoint> <chain> <address>`): the agent pays principal + premium into a Pact coverage pool on Solana; Pact's facilitator side-calls GoldRush (this is where the chain seam is absorbed — the agent only touched Solana); the classifier reads the response — transport error/timeout → `timeout`, 5xx → `server_error`, unsatisfied 402 → `payment_failed`, 4xx → `client_error`, `200` with an error body → `provider_error`, `200` with a missing/malformed `data` field → `schema_error`, otherwise `success`; on anything but `success`, Pact refunds principal + premium on Solana via `settle_batch`. The wrapped run's output continues past the error into a settlement trail with an explorer link.
   - `demo.sh` runs three acts back to back in ~30s: baseline (real 402, no recourse) → wrapped success → wrapped induced failure (`solana-devnet` → GoldRush rejects → refund fires). Each call appends a JSON row to `cli/pact-goldrush-calls.jsonl` — that's the dashboard's input. `cli/SPEC.md` is the canonical interface + JSON-shape contract.

2. **A mini dashboard** (`dashboard/`). One static page (`index.html`, no build step): the GoldRush calls Pact has covered — each row's endpoint, chain, principal, premium, status (`settled` / `refunded` / no-coverage), refund total, upstream latency, error. Summary tiles up top: total calls, settled, refunded, premium earned, total refunded. Pact brand. Ships with an illustrative sample dataset; point it at the CLI's `.jsonl` output to make it live (`?data=…` or swap the file — see `dashboard/README.md`).

3. **This writeup, a ~90s demo-video script** (`VIDEO-SCRIPT.md`) **and a partnership one-pager** (`PARTNERSHIP-ONEPAGER.md`) for the Covalent/GoldRush team, since the integration is additive and worth talking about whether or not it places in the track.

**What's real vs. simulated in the demo:** the GoldRush x402 challenge is **real** — `x402.goldrush.dev` returns an actual `402` with `scheme=exact, network=eip155:84532` (Base Sepolia), the USDC contract, and a per-endpoint price (e.g. 0.0001 USDC on `balances_v2`, 0.02 on `transactions_v3`); with `GOLDRUSH_API_KEY` set the GoldRush *data* is real too (`api.covalenthq.com`). The classifier and the premium maths are real. **Simulated and clearly labelled** (`settlementSimulated: true` in every row): the Pact coverage payment + refund on Solana, and the per-provider reliability score that drives the premium tier. **Stubbed**: actually paying the Base-Sepolia 402 (one labelled function — needs a funded EVM key + `x402-fetch`). Nothing in the demo claims a settlement that didn't happen.

## How it uses GoldRush

The wrapper targets GoldRush's published endpoints — the ones an agent actually wants per-call:

- **Wallet Portfolio** (`balances_v2` — token balances + holdings for an address) — the headline demo call.
- **Activity Feed** (`transactions_v3` — recent transactions / wallet activity) — useful because a truncated activity list is a good example of "the call returned 200 but the data is garbage," which is exactly the `schema_error` case the classifier exists to catch.
- **Pricing** (historical token price) — a third call to show it's not one-endpoint-specific.

All of these are reached through **GoldRush x402**: the agent (here, Pact's facilitator) calls the endpoint with no API key, gets `402 Payment Required` with payment instructions, pays the stablecoin micropayment, retries with proof, and gets the data — the standard x402 request-response cycle GoldRush describes in their x402 launch post. Pact wraps that cycle: it's the thing that decides whether the data that came back was worth the payment, and refunds the agent if it wasn't.

No change to GoldRush's API. Pact is purely additive — it ships next to GoldRush, the same way it ships next to `pay.sh`.

## The Solana angle

The agent only ever touches Solana. It pays its coverage — principal + premium — into a Pact pool on Solana (devnet for the demo, mainnet program `5bCJcdWdK...` in production). Refunds settle on Solana via Pact's on-chain `settle_batch` instruction. The coverage treasury, the classifier observers' attestations, the refund — all Solana.

Honest note on the seam: **GoldRush x402 itself settles on Base** (Base Sepolia today, Base mainnet "coming soon"). So when Pact's facilitator pays GoldRush, that leg is a Base stablecoin payment. We bridge it the simple way for this submission — the facilitator holds the Base side as an internal implementation detail (a funded Covalent key or a Base x402 wallet), and the agent never sees it. From the agent's point of view it's one Solana transaction in, data or a Solana refund out. Native Base settlement for Pact is out of scope here; this is the Solana-side wrapper.

## How to run the demo

Node 20+, no dependencies to install.

```bash
cd cli
./demo.sh        # baseline → wrapped-success → wrapped-failure-with-refund, side by side, ~30s
```

Single calls (endpoints: `portfolio`, `activity`, `price`):

```bash
# baseline: direct GoldRush x402 call — agent eats the cost on failure
node bin/goldrush.js -v call portfolio solana-mainnet So11111111111111111111111111111111111111112

# wrapped: Pact covers it — success path (release premium to provider)
node bin/goldrush.js -v pact pay goldrush portfolio solana-mainnet So11111111111111111111111111111111111111112

# wrapped: induced failure (unsupported chain) — Pact refunds principal + premium
node bin/goldrush.js -v pact pay goldrush portfolio solana-devnet So11111111111111111111111111111111111111112
```

Set `GOLDRUSH_API_KEY` (free tier at goldrush.dev) to make the success path return real Covalent data instead of a simulated body; without it you still get the real `402` challenge. Add `--json` for the machine-readable row only.

Dashboard:

```bash
cd dashboard
npm run dev        # static server (npx serve); open the printed localhost URL
```

It loads `dashboard/data/calls.sample.json` (illustrative rows). To run it against a live demo, run `./demo.sh` a few times and point the page at `cli/pact-goldrush-calls.jsonl` — see `dashboard/README.md`.

## Why it matters

**For GoldRush:** an SLA/refund layer for agentic consumers, at zero engineering cost. GoldRush keeps shipping the best multichain data API; Pact handles the part that makes a finance team comfortable letting an agent spend real money against it per-call. "GoldRush data, with a money-back guarantee on the call" is a line GoldRush can use and didn't have to build. It's the difference between a demo budget and an uncapped one.

**For the agent economy:** humans buying APIs have had chargebacks, refunds, and dispute windows for decades. Agents buying APIs via x402 have none of it. That gap is real money — there's already over $18K in documented on-chain losses from agent-payment failures with no recovery path, on a market projected to grow roughly 100,000× by 2030. Pact is the risk layer for that. GoldRush x402 is a clean, real, multichain place to show it working.

## Links

- Repo (this entry): https://github.com/pactnetwork/pact-goldrush
- Demo video: _[TODO]_
- Pact Network: https://pactnetwork.io
- Pact mainnet program: `5bCJcdWdK...` (Solana)
- GoldRush x402: https://goldrush.dev/blog/goldrush-x402-blockchain-data-for-agents/
- Pact market problem (the why, with sources): `PLAN.md` and the Pact docs at pactnetwork.io
