# Pact × GoldRush — a refund layer for x402 data calls

_One-pager for the Covalent / GoldRush team._

## Who we are

Pact Network is the risk layer for agent payments on Solana. x402 (and Solana's `pay.sh`) gave agents a way to pay for an API call instantly and without an account. What it didn't give them is recourse — when the call fails or returns garbage after payment, the money's gone. There's no chargeback, no dispute window, no refund path. Pact builds that path. We have a live mainnet protocol on Solana (program `5bCJcdWdK...`), a facilitator, a classifier that grades responses, an on-chain settlement program that issues refunds, and a CLI (`pact-cli`, on npm) that already settles real refunds on mainnet.

## What the integration does

We wrap a GoldRush x402 call in a Pact coverage flow:

1. The agent runs `pact pay goldrush <endpoint>` instead of calling GoldRush directly.
2. The agent pays the call's price plus a small premium into a Pact coverage pool on Solana.
3. Pact's facilitator makes the GoldRush call (via GoldRush x402 — `402` → pay → retry → data).
4. Pact's classifier reads the response — HTTP status, latency, whether the body matches the endpoint's schema — and tags it `success` / `client_error` / `server_error` / `timeout` / `schema_mismatch`.
5. On anything but `success`, Pact refunds the principal **and** the premium, on-chain, in seconds.
6. On `success`, Pact keeps the premium. That's the only time we earn.

Nothing changes on your side. No API change, no SDK change, no PR into your repo. Pact ships next to GoldRush, the same way it ships next to `pay.sh`. The wrapper targets your published endpoints — Wallet Portfolio, Activity Feed, Pricing are the ones in our demo, and the pattern generalizes to the rest of the 60+.

One honest note on chains: GoldRush x402 settles on Base; Pact settles on Solana. In our demo the agent only touches Solana and the facilitator holds the Base leg internally — so the agent sees one Solana transaction in, data or a Solana refund out. A native cross-chain settlement path is a thing we'd build with you if there's appetite; it's not required for the integration to work.

## What GoldRush gets

- **An SLA / money-back layer for agentic consumers, at zero engineering cost.** "GoldRush data, with a refund on the call if it fails" — a line you can use that you didn't have to build.
- **A reason for agent operators to uncap budgets against GoldRush.** The data's already good; the missing piece is recourse. That's the difference between a demo budget and a real one.
- **Reliability signal.** Every covered call is a graded data point — uptime and quality, per endpoint, observable. Useful to you, not just to us.
- **A co-marketing story** at exactly the moment x402 mainnet lands: the first blockchain-data API for agents that ships with a refund guarantee.

## What we need from you

Nothing required. The integration is additive and we can ship it standalone.

If there's interest, two optional things would help:
- **A featured / endorsed x402 endpoint** we can point the demo at (or just a faucet-funded Base Sepolia setup we can rely on).
- **Co-marketing** — a mention in an ecosystem post or a link from your x402 / agents docs to the Pact wrapper.

That's it. No roadmap dependency, no exclusivity ask.

## Why now

x402 mainnet is "coming soon" on your side. The moment real value moves per-call, the lack of recourse goes from a footnote to the thing a finance team asks about. There's already over $18K in documented on-chain losses from agent-payment failures with no recovery path, on a market McKinsey puts at $3T–$5T by 2030. Someone is going to be the refund layer for agent data calls. We'd like it to be us, and we'd like GoldRush to be the first place it's visibly working.

## Contact

Pact Network — admin@quantum3labs.com · https://pactnetwork.io
