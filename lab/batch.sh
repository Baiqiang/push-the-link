#!/usr/bin/env bash
# Run lab themes in parallel: lab/batch.sh MULT theme1 theme2 ...
cd "$(dirname "$0")/.."
mult=$1
shift
for th in "$@"; do
  ROUND=${ROUND:-1} MULT=$mult KEEP=${KEEP:-3} SEED=${SEED:-1} npx vitest run --config lab/vitest.config.ts -t "^$th\$" > "lab/out/$th.log" 2>&1 &
done
wait
