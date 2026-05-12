# Pact × GoldRush — data-or-your-money-back for agent data calls

Submission for the **Build with GoldRush** Frontier (Solana) side track on Superteam Earn.

**Pact wraps a GoldRush x402 data call with a refund guarantee.** An agent runs `pact pay goldrush <endpoint>` instead of calling GoldRush directly: it pays the call's price plus a small premium into a Pact coverage pool on Solana, Pact's facilitator makes the GoldRush call, a classifier grades the response, and if the call failed or the body is garbage, Pact refunds principal + premium on Solana. Pact only keeps the premium when the call worked. No change to GoldRush's API.

## What's here

| Path | What |
|---|---|
| [`SUBMISSION.md`](./SUBMISSION.md) | The full writeup — problem, what we built, how it uses GoldRush, the Solana angle, how to run, why it matters. **Start here.** |
| [`cli/`](./cli) | The `pact pay goldrush` wrapper CLI + `demo.sh`. Zero deps, Node 20+. See [`cli/SPEC.md`](./cli/SPEC.md) for the interface contract. |
| [`dashboard/`](./dashboard) | A static one-page dashboard of the GoldRush calls Pact has covered (settled / refunded / premium earned). |
| [`VIDEO-SCRIPT.md`](./VIDEO-SCRIPT.md) | ~90s demo-video script — shot list + voiceover. |
| [`PARTNERSHIP-ONEPAGER.md`](./PARTNERSHIP-ONEPAGER.md) | Standalone pitch to the Covalent/GoldRush team. |
| [`PLAN.md`](./PLAN.md) | The build plan and decisions log. |

## Quick start

```bash
cd cli
./demo.sh        # baseline → wrapped-success → wrapped-failure-with-refund, ~30s

cd ../dashboard
npm run dev      # static server; open the printed URL
```

The GoldRush x402 challenge in the demo is real (`x402.goldrush.dev` → real `402` on Base Sepolia); with `GOLDRUSH_API_KEY` set the GoldRush data is real too. The Pact Solana settlement is simulated for the demo and labelled as such in every output row — the classifier rules and on-chain instruction shape are the ones Pact ships on mainnet.

## Pact Network

Live mainnet protocol on Solana — facilitator, response classifier, on-chain settlement program, and `pact-cli` (on npm) that already settles real refunds on mainnet. https://pactnetwork.io
