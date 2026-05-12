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

**On screen:** Run the direct call:

```
$ node bin/goldrush.js -v call portfolio solana-mainnet So111...112
GET https://x402.goldrush.dev/v1/solana-mainnet/address/So111...112/balances_v2/
[goldrush] HTTP 402 Payment Required (310ms)
[goldrush] x402: pay 0.0001 USDC on eip155:84532 to 0xA3…9de6
[pact] classifier: payment_failed
[baseline] no coverage — agent paid for the call and got payment_failed; nothing refunded.
$
```

Let the cursor sit on the prompt for a beat. The silence is the point. (If you set `GOLDRUSH_API_KEY` the same line returns real Covalent data — for the contrast you want it to fail, so leave the key unset, or run it against a chain GoldRush rejects.)

**VO:**
"So I ask GoldRush for a wallet portfolio. It comes back four-oh-two — pay the micropayment, on Base, then retry. That's the x402 deal. But if anything goes wrong after I've paid — the upstream's down, the body comes back empty, wrong chain — I'm done. I paid, I got nothing, and there's nowhere to file that. Now picture an agent doing this a few thousand times a day. The failure rate doesn't have to be big for 'no recourse' to be the reason you don't uncap the budget."

---

### Shot 3 — `pact pay goldrush` — covered, then refunded (0:35–1:08)

**On screen:** First the success path, then the failure path:

```
$ node bin/goldrush.js -v pact pay goldrush portfolio solana-mainnet So111...112
[pact] quote: principal 0.0010 USDC + premium 0.019 USDC (tier=ELEVATED, failureRate=1.2%)
[pact] coverage paid on Solana: 2E1v…ExKU (settle_batch ~36s · SIMULATED)
[pact] facilitator side-calls GoldRush on the agent's behalf… (chain seam handled here — agent only touched Solana)
[goldrush] HTTP 200 (434ms)
[pact] classifier: success (200, schema OK)
[pact] settled: GoldRush receives 0.0010 USDC, Pact keeps premium 0.019 USDC

$ node bin/goldrush.js -v pact pay goldrush portfolio solana-devnet So111...112
[pact] quote: principal 0.0010 USDC + premium 0.019 USDC (tier=ELEVATED, failureRate=1.2%)
[pact] coverage paid on Solana: TVkE…QN5e (settle_batch ~51s · SIMULATED)
[pact] facilitator side-calls GoldRush on the agent's behalf…
[goldrush] HTTP 400 (649ms)
[pact] classifier: client_error (request rejected 400)
[pact] policy: refund_on_failed_data
[pact] refund 0.020 USDC -> agent: t3iV…GPTM (settle_batch ~36s · SIMULATED)
[pact] principal + premium both refunded — Pact net $0.000 on this call
$
```

Highlight the `classifier:` lines and the final `net $0.000` line.

**VO:**
"Same calls, wrapped. `pact pay goldrush`. I pay the call's price plus a small premium into a Pact pool on Solana, Pact's facilitator makes the GoldRush call for me — that's where the Base side gets handled, I never see it — and the classifier grades what comes back. First one's a clean two hundred: Pact passes the payment through, keeps the premium. Second one I point at a chain GoldRush rejects — four hundred. Classifier flags it, and Pact refunds me on Solana. Principal and premium, both back. Net cost: zero. Pact only keeps the premium when the call actually works. So my downside on a bad call is nothing, and GoldRush didn't have to change a line."

_(The Solana settlement here is simulated for the recording — every row says so (`SIMULATED` / `settlementSimulated: true`). The GoldRush 402 and the classifier are real. Say that in the VO if you want: "the on-chain settlement's simulated for this clip — the classifier rules and the instruction shape are the real ones Pact ships on mainnet.")_

---

### Shot 4 — Dashboard glance (1:08–1:22)

**On screen:** Switch to the browser tab — the mini dashboard. A short table of covered GoldRush calls: a couple `settled` (premium earned, small green number), a couple `refunded` (premium returned). A "premium earned" and "total refunded" tally at the top. Slow scroll, ~8 seconds.

**VO:**
"And it's all visible. Every call Pact covers shows up here — what settled, what got refunded, what Pact earned. Reliability signal for the agent, and for GoldRush, for free."

---

### Shot 5 — Close (1:22–1:32)

**On screen:** Back to a clean card:
`Pact Network — the refund layer for agent payments.`
`pactnetwork.io · Solana mainnet 5bCJcdWdK…`
`GoldRush x402: goldrush.dev`

**VO:**
"Humans buying APIs have had chargebacks for decades. Agents buying APIs have had nothing. Pact's the layer that fixes that — and GoldRush x402 is a clean place to show it working. That's it. Thanks."

---

## Notes for the recording

- Use a flaky endpoint you control so the failure is reliable on the first take. Don't gamble on a real timeout happening on camera.
- Keep the two terminal runs visually identical up to the error body — the whole story is what happens *after* the error. Baseline ends there; wrapped run keeps going.
- If you have a real explorer link to a devnet `settle` tx, click it briefly. If not, don't fake the click — just show the line and say it's simulated.
- 90 seconds is tight. If you're over, cut the dashboard scroll, not the two-terminal contrast.

