# GoldRush calls covered by Pact — mini dashboard

A single static page showing GoldRush x402 data calls wrapped by Pact: how many
settled vs. refunded, premium earned, and total refunded. Part of the Pact ×
Covalent GoldRush "Build with GoldRush" Frontier (Solana) side-track submission.

> Every GoldRush x402 call here is wrapped by Pact — if it fails, the agent gets
> principal + premium back. Pact earns the premium only on successful calls;
> refunded calls return principal + premium, net $0.000 to Pact.

## Run it

It's a static page — needs to be served over HTTP (the page `fetch()`s the JSON,
which `file://` blocks).

```bash
cd goldrush-track/dashboard
npm run dev          # serves on http://localhost:4178
```

`npm run dev` just shells out to `npx serve`. Any static server works, e.g.:

```bash
python3 -m http.server 4178
# then open http://localhost:4178
```

No build step, no dependencies to install. Tailwind/React were not needed — it's
plain HTML + CSS + a small `<script>`. The Pact brand (copper `#B87333`, dark
`#151311`, Inria Serif/Sans + JetBrains Mono, 0px radius / brutalist) is matched
inline.

## Feeding it real data

The page loads `data/calls.sample.json` by default. Two ways to point it at real
output from the `pact pay goldrush` demo CLI (`goldrush-track/cli/`):

1. **Query param** — drop your file anywhere reachable by the static server and
   load `?data=<path-or-url>`, e.g.
   `http://localhost:4178/?data=data/calls.live.json`
   or even an absolute URL if CORS allows it.

2. **File swap** — overwrite `data/calls.sample.json` (or symlink it) with the
   CLI output. The CLI is expected to emit a JSON array of call records.

### Expected JSON shape

A JSON array (or `{ "calls": [...] }`) of records:

```json
{
  "id": "gr_8f3a21",
  "ts": 1747044000000,
  "endpoint": "wallet-portfolio",
  "chain": "solana-mainnet",
  "principal": 0.002,
  "premium": 0.0002,
  "status": "settled",
  "refundTotal": 0,
  "upstreamLatencyMs": 240,
  "error": null
}
```

| field | meaning |
| --- | --- |
| `id` | call id |
| `ts` | unix epoch **ms** |
| `endpoint` | `wallet-portfolio` \| `activity-feed` \| `pricing` (other strings render as-is) |
| `chain` | chain id string (e.g. `solana-mainnet`) |
| `principal` | USD paid for the GoldRush call |
| `premium` | USD coverage premium |
| `status` | `settled` \| `refunded` |
| `refundTotal` | USD refunded (0 unless refunded; on refund = principal + premium) |
| `upstreamLatencyMs` | GoldRush upstream latency in ms (0 / `n/a` when the call never reached upstream) |
| `error` | failure reason string when `refunded`, else `null` |

Refunded rows are highlighted (amber badge, tinted row, left accent bar) and show
the error reason.

## Files

- `index.html` — the whole app
- `data/calls.sample.json` — ~12 demo rows (mix of settled + refunded)
- `package.json` — `npm run dev` shim
