#!/usr/bin/env bash
# Pact × GoldRush — side-by-side demo. Screen-record this (~30s).
#
# Three acts: (1) baseline GoldRush call that fails — agent paid, got nothing,
# no recourse; (2) the SAME failing call wrapped by Pact — refund of principal
# + premium fires on Solana; (3) a call that works — Pact passes the payment
# through and keeps the premium. Pact only earns when the call works.
#
# Real GoldRush calls. With GOLDRUSH_API_KEY set you hit api.covalenthq.com
# (real data / real upstream errors); without it you hit x402.goldrush.dev and
# see the real 402. Pact's Solana settlement is SIMULATED and labelled
# (settlementSimulated: true) — the classifier rules and instruction shape are
# the ones Pact ships on mainnet.
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
type_cmd "goldrush call portfolio solana-devnet $ADDR    # upstream rejects -> agent paid, got nothing"
$CLI -v call portfolio solana-devnet "$ADDR" >/dev/null || true
echo
sleep 2
hr
printf "\033[1m2. Wrapped — \033[36mpact pay goldrush\033[0m\033[1m, same failing call. Refund fires.\033[0m\n"
echo
type_cmd "pact pay goldrush portfolio solana-devnet $ADDR    # GoldRush rejects -> Pact refunds principal + premium"
$CLI -v pact pay goldrush portfolio solana-devnet "$ADDR" >/dev/null
echo
sleep 2
hr
printf "\033[1m3. Wrapped — a call that works. Pact passes the payment through, keeps the premium.\033[0m\n"
echo
type_cmd "pact pay goldrush portfolio solana-mainnet $ADDR"
# Without GOLDRUSH_API_KEY this falls back to a simulated 200 body; add --force-success
# to guarantee the green path on the recording regardless of upstream.
$CLI -v pact pay goldrush portfolio solana-mainnet "$ADDR" >/dev/null
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
