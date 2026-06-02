#!/usr/bin/env bash
set -euo pipefail

# ElysiaJS リクエストベンチマーク
#   - Elysia 単体 (Node)      : http://localhost:3001/
#   - Elysia 単体 (Bun)       : http://localhost:3002/
#   - Next.js + Elysia        : http://localhost:3000/api
#   - TanStack Start + Elysia : http://localhost:3003/api
#   - Astro + Elysia          : http://localhost:3004/api
#
# 計測対象のサーバを事前に起動しておくこと（起動していないものは自動でスキップ）:
#   pnpm start:elysia        # Node 版 (:3001)
#   pnpm start:elysia:bun    # Bun 版  (:3002)
#   pnpm build:next && pnpm start:next             # Next.js 版 (:3000)
#   pnpm build:tanstack && pnpm start:tanstack     # TanStack Start 版 (:3003)
#   pnpm build:astro && pnpm start:astro           # Astro 版 (:3004)
#
# パラメータは環境変数で上書き可能:
#   DURATION  計測時間   (default 30s)
#   CONN      同時接続数 (default 50)
#   WARMUP    ウォームアップ時間 (default 5s)

DURATION="${DURATION:-30s}"
CONN="${CONN:-50}"
WARMUP="${WARMUP:-5s}"

# "ラベル|URL" のリスト。先頭から順に計測する。
TARGETS=(
  "Elysia standalone (Node)|http://localhost:3001/"
  "Elysia standalone (Bun)|http://localhost:3002/"
  "Next.js + Elysia (Node)|http://localhost:3000/api"
  "TanStack Start + Elysia (Node)|http://localhost:3003/api"
  "Astro + Elysia (Node)|http://localhost:3004/api"
)

run_bench() {
  local name="$1"
  local url="$2"

  echo "============================================================"
  echo " ${name}"
  echo " URL: ${url} / conn=${CONN} / duration=${DURATION}"
  echo "============================================================"

  echo "--- warmup (${WARMUP}) ---"
  oha -z "${WARMUP}" -c "${CONN}" --no-tui "${url}" >/dev/null

  echo "--- measure (${DURATION}) ---"
  oha -z "${DURATION}" -c "${CONN}" --no-tui "${url}"
  echo
}

# 到達できるエンドポイントだけを計測対象にする
echo "Checking endpoints..."
available=()
for target in "${TARGETS[@]}"; do
  name="${target%%|*}"
  url="${target##*|}"
  if curl -sf "${url}" >/dev/null 2>&1; then
    echo "  [OK]   ${name} (${url})"
    available+=("${target}")
  else
    echo "  [skip] ${name} (${url}) — 未起動"
  fi
done
echo

if [ "${#available[@]}" -eq 0 ]; then
  echo "ERROR: 到達できるエンドポイントがありません。サーバを起動してください。"
  exit 1
fi

for target in "${available[@]}"; do
  run_bench "${target%%|*}" "${target##*|}"
done
