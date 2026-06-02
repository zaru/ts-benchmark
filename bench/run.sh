#!/usr/bin/env bash
set -euo pipefail

# ElysiaJS リクエストベンチマーク
#   - Elysia 単体        : http://localhost:3001/
#   - Next.js + Elysia   : http://localhost:3000/api
#
# 事前に両サーバを起動しておくこと:
#   pnpm start:elysia
#   pnpm build:next && pnpm start:next
#
# パラメータは環境変数で上書き可能:
#   DURATION  計測時間   (default 30s)
#   CONN      同時接続数 (default 50)
#   WARMUP    ウォームアップ時間 (default 5s)

DURATION="${DURATION:-30s}"
CONN="${CONN:-50}"
WARMUP="${WARMUP:-5s}"

ELYSIA_URL="http://localhost:3001/"
NEXT_URL="http://localhost:3000/api"

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

# 到達性チェック
echo "Checking endpoints..."
curl -sf "${ELYSIA_URL}" >/dev/null || { echo "ERROR: Elysia 単体 (${ELYSIA_URL}) に到達できません。pnpm start:elysia を起動してください。"; exit 1; }
curl -sf "${NEXT_URL}" >/dev/null   || { echo "ERROR: Next.js (${NEXT_URL}) に到達できません。pnpm build:next && pnpm start:next を起動してください。"; exit 1; }
echo "OK"
echo

run_bench "Elysia standalone (Node)" "${ELYSIA_URL}"
run_bench "Next.js + Elysia (Node)" "${NEXT_URL}"
