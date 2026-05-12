# Demo video script — Pact × GoldRush (~90 seconds)

Target length: 85–95s. One terminal, one browser tab. Screen recording, voiceover on top. No music bed needed; if you add one, keep it under the voice.

Banned from the VO: "leverage", "seamless", "revolutionize", "in today's fast-paced world", "game-changer". Talk like a person.

---

### Shot 1 — Hook (0:00–0:12)

**On screen:** Title card, plain. Black background. Text:
`Agents can pay for data per-call now. They just can't get their money back.`
Then cut to a terminal prompt, blinking.

**VO:**
"GoldRush x402 lets an agent buy blockchain data per call — no API key, no account, just a stablecoin micropayment. That's great. Here's the part nobody mentions: if the call fails after you've paid, that's it. There's no chargeback."

---

### Shot 2 — Baseline GoldRush x402 call, eating the cost (0:12–0:35)

**On screen:** Run the direct call. Something like:

```
$ node bin/pact-goldrush.js goldrush wallet-portfolio base-sepolia 0xAbC...123
402 Payment Required (x402) — 0.02 USDC on Base
Paying... payment confirmed, retrying...

{"error":"upstream_timeout","data":null}
$
```

Let the cursor sit on the empty prompt for a beat after the error. Don't cut away immediately — the silence is the point.

**VO:**
"So I ask GoldRush for a wallet portfolio. It quotes me two cents on Base, I pay, it retries — and the upstream times out. Empty body. I paid. I got nothing. And there's nowhere to file that. Now imagine an agent doing this a few thousand times a day. The failure rate doesn't have to be big for 'no recourse' to be the reason you don't uncap the budget."

---

### Shot 3 — `pact pay goldrush` — same call, refunded (0:35–1:08)

**On screen:** Run the wrapped version. Same endpoint, same flaky upstream:

```
$ node bin/pact-goldrush.js pact pay goldrush wallet-portfolio base-sepolia 0xAbC...123
[pact] coverage: 0.020 USDC principal + 0.001 premium → pool pact-goldrush (Solana devnet)
402 Payment Required (x402) — 0.02 USDC on Base
Paying... payment confirmed, retrying...

{"error":"upstream_timeout","data":null}

[pact] classifier: server_error  (status=503, latency=1240ms, schema=n/a)
[pact] policy: refund_on_server_error  (endpoint=wallet-portfolio)
[pact] settle: 9rT3…aP1X  on Solana  (refund: principal + premium)
[pact] https://solscan.io/tx/9rT3...aP1X
[pact] net cost: 0.000 USDC — Pact only earns when the call works
$
```

Highlight (cursor or a subtle box) the two lines: `classifier: server_error` and `net cost: 0.000`.

**VO:**
"Same call, wrapped. `pact pay goldrush`. I pay the two cents plus a one-tenth-of-a-cent premium into a Pact pool on Solana. Pact's facilitator makes the GoldRush call for me. Same flaky upstream, same empty body — but now the classifier sees the 503, tags it a server error, and Pact settles a refund on Solana. Principal and premium, both back. Net cost: zero. Pact only keeps the premium when the call actually returns good data. So my downside on a bad call is nothing, and GoldRush didn't have to change a line."

_(If the demo's settlement is simulated rather than a live devnet tx, the `[pact]` lines should say so — e.g. `settle (simulated)` — and the VO should add: "the settlement here is simulated for the recording — the classifier rules and the on-chain instruction are the real ones Pact ships.")_

---

### Shot 4 — Dashboard glance (1:08–1:22)

**On screen:** Switch to the browser tab — the mini dashboard. A short table of covered GoldRush calls: a couple `settled` (premium earned, small green number), a couple `refunded` (premium returned). A "premium earned" and "total refunded" tally at the top. Slow scroll, ~8 seconds.

**VO:**
"And it's all visible. Every call Pact covers shows up here — what settled, what got refunded, what Pact earned. Reliability signal for the agent, and for GoldRush, for free."

---

### Shot 5 — Close (1:22–1:32)

**On screen:** Back to a clean card:
`Pact Network — the refund layer for agent payments.`
`pactnetwork.io · Solana mainnet 5bCJcdWdK...`
`GoldRush x402: goldrush.dev`

**VO:**
"Humans buying APIs have had chargebacks for decades. Agents buying APIs have had nothing. Pact's the layer that fixes that — and GoldRush x402 is a clean place to show it working. That's it. Thanks."

---

## Notes for the recording

- Use a flaky endpoint you control so the failure is reliable on the first take. Don't gamble on a real timeout happening on camera.
- Keep the two terminal runs visually identical up to the error body — the whole story is what happens *after* the error. Baseline ends there; wrapped run keeps going.
- If you have a real Solscan link to a devnet `settle` tx, click it briefly. If not, don't fake the click — just show the line and say it's simulated.
- 90 seconds is tight. If you're over, cut the dashboard scroll, not the two-terminal contrast.
- TODO: lock the exact CLI command strings against `goldrush-track/cli/` once it's built; the ones above are from the plan.
