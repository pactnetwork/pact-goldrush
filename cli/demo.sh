#!/usr/bin/env bash
# Pact × GoldRush — side-by-side demo. Screen-record this (~30s).
#
# Shows: baseline GoldRush call (agent eats the cost) vs Pact-wrapped (coverage
# on Solana + refund on failed data). Two outcomes: one success, one induced
# failure (unsupported chain) so the refund path is visible.
#
# Real GoldRush calls (x402.goldrush.dev — you'll see the real 402). Pact's
# Solana settlement is SIMULATED and labelled (settlementSimulated: true).
# Set GOLDRUSH_API_KEY for real Covalent data on the success path.
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node $DIR/bin/goldrush.js"
ADDR="So11111111111111111111111111111111111111112"   # wrapped SOL mint — always exists
export PACT_OUT="$DIR/pact-goldrush-calls.jsonl"
: > "$PACT_OUT"   # fresh log for the dashboard

type_cmd() {
  printf "\033[1;37m$ \033[0m"
  local s="$1"; for ((i=0;i<${#s};i++)); do printf "%s" "${s:$i:1}"; sleep 0.018; done
  printf "\n"
}
hr() { printf "\033[2m%s\033[0m\n" "────────────────────────────────────────────────────────"; }

clear
echo
printf "\033[1;36mPact Network × Covalent GoldRush\033[0m  \033[2m— data-or-your-money-back for agents\033[0m\n"
echo
hr
printf "\033[1m1. Baseline — agent calls GoldRush directly. No coverage.\033[0m\n"
echo
type_cmd "goldrush call portfolio solana-mainnet $ADDR"
$CLI -v call portfolio solana-mainnet "$ADDR" >/dev/null
echo
sleep 2
hr
printf "\033[1m2. Wrapped — \033[36mpact pay goldrush\033[0m\033[1m. Coverage on Solana, success path.\033[0m\n"
echo
type_cmd "pact pay goldrush portfolio solana-mainnet $ADDR"
# --force-success: green path without depending on a live API key for the recording.
# Drop this flag (and set GOLDRUSH_API_KEY) for a fully-real success.
$CLI -v --force-success pact pay goldrush portfolio solana-mainnet "$ADDR" >/dev/null
echo
sleep 2
hr
printf "\033[1m3. Wrapped — induced failure (unsupported chain). Refund fires.\033[0m\n"
echo
type_cmd "pact pay goldrush portfolio solana-devnet $ADDR    # GoldRush rejects -> Pact refunds principal + premium"
$CLI -v pact pay goldrush portfolio solana-devnet "$ADDR" >/dev/null
echo
sleep 1
hr
printf "\033[1mEvery call emitted a JSON row (this feeds the dashboard):\033[0m\n"
echo
cat "$PACT_OUT"
echo
printf "\033[2mReal GoldRush calls · Pact Solana settlement simulated & labelled (settlementSimulated: true)\033[0m\n"
printf "\033[2mpactnetwork.io  ·  goldrush.dev\033[0m\n"
echo
