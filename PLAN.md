# Pact × GoldRush — Frontier side-track submission

**One line:** Pact gives GoldRush x402 data calls a "data-or-your-money-back" guarantee — an agent pays for a GoldRush API call wrapped by Pact; if the call fails or returns garbage, Pact refunds principal + premium.

## Background facts (verified 2026-05-12)
- Listing: https://superteam.fun/earn/listing/build-with-goldrush-track-powered-by-covalent — Covalent GoldRush track, $3k pool ($1.5k/$1k/$0.5k), winners announced May 26 2026. Frontier (Solana) side track. **Exact submission deadline NOT stated on the page — must confirm with the organizer.**
- GoldRush x402: https://goldrush.dev/blog/goldrush-x402-blockchain-data-for-agents/ — transparent reverse proxy in front of `api.covalenthq.com`; call w/o key → `402 Payment Required` → pay stablecoin micropayment on **Base** → retry → data. Live on **Base Sepolia testnet**, mainnet "coming soon". Also: agent skills (github.com/covalenthq/goldrush-agent-skills), MCP/agents page (goldrush.dev/agents).
- Pact Network: Solana x402 insurance/refund protocol. Has: protocol program (mainnet `5bCJcdWdK...`), settler, facilitator (Cloud Run, Direct-VPC-egress), `pact-cli` (npm, 0.2.6 — `pact pay` settles on-chain via pay-default pool, verified mainnet tx), `market-proxy` (x-pact-signature gated), indexer, dashboard (Cloud Run). Refund policy: refunds return principal + premium; Pact earns only on successful calls. Monorepo lives in `../pact-monitor/`. Mock demo CLI in `../pact-pay-demo/`.

## Chain seam (the one real friction point)
GoldRush x402 settles on **Base**; Pact settles on **Solana**. For the submission we do **option 1 — Solana-side wrapper**: the agent only touches Solana (pays coverage into a Pact pool on Solana mainnet/devnet). The facilitator side-calls GoldRush as an internal implementation detail — either with a funded Covalent API key OR via GoldRush's Base x402 proxy. The Base payment, if any, is invisible to the agent. Native Base settlement for Pact is out of scope.

## Deliverables
1. **`pact pay goldrush` demo CLI** (`goldrush-track/cli/`) — wraps a GoldRush call (Wallet Portfolio / Activity Feed) in a Pact coverage flow. Two paths shown side by side:
   - baseline: direct GoldRush x402 call — agent eats the cost on failure/garbage
   - wrapped: `pact pay goldrush ...` — facilitator side-calls GoldRush, classifier decides success/failure, Pact refunds principal+premium on failure
   - `demo.sh` records both in ~30s. Real GoldRush x402 calls against Base Sepolia where possible; Pact coverage either real (devnet pool via pact-monitor backend) or faithfully simulated if real wiring is too heavy for the timeline — clearly labelled.
2. **Submission writeup** (`goldrush-track/SUBMISSION.md`) — problem / what we built / how it uses GoldRush / demo steps / why it matters / links. Founder voice, no AI/marketing copy. Plus a short standalone partnership one-pager for Covalent (`goldrush-track/PARTNERSHIP-ONEPAGER.md`) in case the deadline has passed.
3. **Mini dashboard** (`goldrush-track/dashboard/`) — single page: list of GoldRush calls covered by Pact, status (settled / refunded), premium earned, refund total. Mock data first, wire to CLI output if time. Match Pact brand.

## Out of scope
- Pact native Base/EVM settlement path.
- Any change to GoldRush's API or the upstream `pay` CLI — integration is purely additive (Pact ships next to them).
- Mainnet money movement beyond what already works.

## Open items
- [x] Deadline confirmed: **TODAY (2026-05-12)** — ship fast, simulated coverage is acceptable, label what's real vs simulated.
- [ ] Decide: real devnet Pact pool wiring vs. simulated coverage for the demo (depends on time + facilitator access from this workspace).
- [ ] Get a GoldRush x402 endpoint working (Base Sepolia faucet USDC, x402 client lib).
