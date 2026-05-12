# Pact × GoldRush — data-or-your-money-back for agent data calls

**Track:** Build with GoldRush (Frontier / Solana side track), Superteam Earn — https://superteam.fun/earn/listing/build-with-goldrush-track-powered-by-covalent
**Team:** Pact Network
**Repo:** https://github.com/quantum3labs/pact-monitor (this entry: `goldrush-track/`)
**Demo video:** _[TODO: link]_
**Pact mainnet program:** `5bCJcdWdK...` (Solana mainnet) · https://pactnetwork.io

---

## What it is

Pact gives a GoldRush x402 data call a refund guarantee. An agent runs `pact pay goldrush <endpoint>` instead of calling GoldRush directly: it pays the call's price plus a small premium into a Pact coverage pool on Solana, Pact's facilitator makes the GoldRush call on the agent's behalf, a classifier checks whether the response actually arrived and looks like real data, and if the call failed or the body is garbage, Pact refunds the principal and the premium. Pact only keeps the premium when the call worked. GoldRush doesn't have to do anything — the wrapper sits next to their API, not inside it.

## The problem

x402 makes a data call a payment. That's the whole point — an agent can buy a Wallet Portfolio lookup for a few cents without an account or an API key. But a payment that settles instantly and irreversibly has no recourse attached. If GoldRush's upstream times out, returns a 500, or the body comes back truncated or empty, the agent already paid. There's no chargeback, no dispute window, no "try again for free." A human who buys something broken calls Visa. An agent that buys something broken eats it.

That's fine when an agent is spending $0.31 on one call. It stops being fine the moment an agent operator wants to uncap a budget and run thousands of data calls a day. The failure rate doesn't have to be high — a median production API runs around a 0.5% error rate — for "no recourse" to be the reason a finance team won't sign off. The data is good. The payment rail is missing a piece.

## What we built

In `goldrush-track/`:

1. **`pact pay goldrush` — the wrapper CLI** (`goldrush-track/cli/`). It wraps a GoldRush call in a Pact coverage flow. The demo shows two paths side by side:
   - **baseline:** a direct GoldRush x402 call. On a failed or garbage response, the agent has paid and has nothing.
   - **wrapped:** `pact pay goldrush ...`. The agent pays principal + premium into a Pact pool on Solana; the facilitator side-calls GoldRush; the classifier reads the response (HTTP status, latency, whether the JSON shape matches the endpoint's schema) and tags it `success` / `client_error` / `server_error` / `timeout` / `schema_mismatch`; on anything but `success`, Pact settles a refund of principal + premium on-chain. The wrapped run's output continues past the error body into a settlement trail with a Solscan link.
   - `demo.sh` records both in about 30 seconds.

   > **TODO — reconcile exact commands.** As of this writing `goldrush-track/cli/` is being built; the command surface above is from the project plan. Once the CLI lands, sync the exact flags, output strings, and `demo.sh` steps here. The pattern is the same one shipped in `pact-cli` (`pact pay` already settles on-chain via Pact's pay-default pool on mainnet) and prototyped in `pact-pay-demo/` — this entry specializes it to GoldRush endpoints.

2. **A mini dashboard** (`goldrush-track/dashboard/`). One page: the GoldRush calls Pact has covered, each row's status (`settled` or `refunded`), premium earned, total refunded. Mock data first; wired to the CLI's output if time allows. Pact brand.

3. **This writeup and a partnership one-pager** (`goldrush-track/PARTNERSHIP-ONEPAGER.md`) for the Covalent/GoldRush team, since the integration is additive and worth talking about whether or not it places in the track.

**What's real vs. simulated in the demo:** the GoldRush x402 calls hit Base Sepolia testnet where we can wire them; Pact's coverage settlement is either a real Pact devnet pool (via the `pact-monitor` backend) or a faithful simulation that mirrors the real classifier rules and on-chain instruction shape — whichever the timeline allows, clearly labelled in the output. Nothing in the demo claims a settlement that didn't happen.

## How it uses GoldRush

The wrapper targets GoldRush's published endpoints — the ones an agent actually wants per-call:

- **Wallet Portfolio** (token balances + NFT holdings for an address) — the headline demo call.
- **Activity Feed** (recent transactions / wallet activity) — second demo call, useful because a truncated activity list is a good example of "the call returned 200 but the data is garbage," which is exactly the `schema_mismatch` case the classifier exists to catch.
- **Pricing** (token spot/historical price) — a third call to show it's not one-endpoint-specific.

All of these are reached through **GoldRush x402**: the agent (here, Pact's facilitator) calls the endpoint with no API key, gets `402 Payment Required` with payment instructions, pays the stablecoin micropayment, retries with proof, and gets the data — the standard x402 request-response cycle GoldRush describes in their x402 launch post. Pact wraps that cycle: it's the thing that decides whether the data that came back was worth the payment, and refunds the agent if it wasn't.

No change to GoldRush's API. Pact is purely additive — it ships next to GoldRush, the same way it ships next to `pay.sh`.

## The Solana angle

The agent only ever touches Solana. It pays its coverage — principal + premium — into a Pact pool on Solana (devnet for the demo, mainnet program `5bCJcdWdK...` in production). Refunds settle on Solana via Pact's on-chain `settle_batch` instruction. The coverage treasury, the classifier observers' attestations, the refund — all Solana.

Honest note on the seam: **GoldRush x402 itself settles on Base** (Base Sepolia today, Base mainnet "coming soon"). So when Pact's facilitator pays GoldRush, that leg is a Base stablecoin payment. We bridge it the simple way for this submission — the facilitator holds the Base side as an internal implementation detail (a funded Covalent key or a Base x402 wallet), and the agent never sees it. From the agent's point of view it's one Solana transaction in, data or a Solana refund out. Native Base settlement for Pact is out of scope here; this is the Solana-side wrapper.

## How to run the demo

```bash
cd goldrush-track/cli
npm install
./demo.sh           # records the baseline call and the wrapped call side by side, ~30s
```

Single calls:

```bash
# baseline: direct GoldRush x402 call — you eat the cost on failure
node bin/pact-goldrush.js goldrush wallet-portfolio <chain> <address>

# wrapped: Pact covers it — refund on failure
node bin/pact-goldrush.js pact pay goldrush wallet-portfolio <chain> <address>
```

Dashboard:

```bash
cd goldrush-track/dashboard
npm install && npm run dev   # open the local URL
```

> **TODO:** exact commands above are from the plan; reconcile with `goldrush-track/cli/` once it's built.

## Why it matters

**For GoldRush:** an SLA/refund layer for agentic consumers, at zero engineering cost. GoldRush keeps shipping the best multichain data API; Pact handles the part that makes a finance team comfortable letting an agent spend real money against it per-call. "GoldRush data, with a money-back guarantee on the call" is a line GoldRush can use and didn't have to build. It's the difference between a demo budget and an uncapped one.

**For the agent economy:** humans buying APIs have had chargebacks, refunds, and dispute windows for decades. Agents buying APIs via x402 have none of it. That gap is real money — there's already over $18K in documented on-chain losses from agent-payment failures with no recovery path, on a market projected to grow roughly 100,000× by 2030. Pact is the risk layer for that. GoldRush x402 is a clean, real, multichain place to show it working.

## Links

- Repo (this entry): `goldrush-track/` in https://github.com/quantum3labs/pact-monitor
- Demo video: _[TODO]_
- Pact Network: https://pactnetwork.io
- Pact mainnet program: `5bCJcdWdK...` (Solana)
- GoldRush x402: https://goldrush.dev/blog/goldrush-x402-blockchain-data-for-agents/
- Pact market problem (the why, with sources): `MARKET-PROBLEM.md` in the repo root
