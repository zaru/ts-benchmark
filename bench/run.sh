#!/usr/bin/env bash
set -euo pipefail

# ElysiaJS リクエストベンチマーク
#   各フレームワークは「素のネイティブ実装 /native」と「Elysia 連携 /api」を
#   同一サーバ・同一ランタイムで両方公開し、Elysia 連携のオーバーヘッドを比較する。
#   - Elysia 単体 (Node)        : http://localhost:3001/
#   - Elysia 単体 (Bun)         : http://localhost:3002/
#   - Next.js native / +Elysia  : http://localhost:3000/native , /api
#   - TanStack native / +Elysia : http://localhost:3003/native , /api
#   - Astro native / +Elysia    : http://localhost:3004/native , /api
#   - AdonisJS native / +Elysia : http://localhost:3005/native , /api
#   - SolidStart native/+Elysia : http://localhost:3006/native , /api
#   - SvelteKit native/+Elysia  : http://localhost:3007/native , /api
#   - Nuxt native / +Elysia     : http://localhost:3008/native , /api
#
# 計測対象のサーバを事前に起動しておくこと（起動していないものは自動でスキップ）:
#   pnpm start:elysia        # Node 版 (:3001)
#   pnpm start:elysia:bun    # Bun 版  (:3002)
#   pnpm build:next && pnpm start:next             # Next.js 版 (:3000)
#   pnpm build:tanstack && pnpm start:tanstack     # TanStack Start 版 (:3003)
#   pnpm build:astro && pnpm start:astro           # Astro 版 (:3004)
#   pnpm build:adonis && pnpm start:adonis         # AdonisJS 版 (:3005)
#   pnpm build:solid && pnpm start:solid           # SolidStart 版 (:3006)
#   pnpm build:svelte && pnpm start:svelte         # SvelteKit 版 (:3007)
#   pnpm build:nuxt && pnpm start:nuxt             # Nuxt 版 (:3008)
#
# 計測前に各エンドポイントのレスポンスが期待ペイロードと一致するかを検証し、
# 一致したものだけを計測対象にする（「正常に動いたうえでの計測」を担保する）。
#
# パラメータは環境変数で上書き可能:
#   DURATION  計測時間   (default 30s)
#   CONN      同時接続数 (default 50)
#   WARMUP    ウォームアップ時間 (default 5s)

DURATION="${DURATION:-30s}"
CONN="${CONN:-50}"
WARMUP="${WARMUP:-5s}"

# 全エンドポイントが返すべき共通ペイロード（packages/payload/index.ts と一致させる）
EXPECTED_RAW='{"message":"Hello Elysia","framework":"elysia","items":[{"id":1,"name":"alpha","active":true},{"id":2,"name":"beta","active":false},{"id":3,"name":"gamma","active":true}],"meta":{"count":3,"version":"1.0.0"}}'

# JSON をキー順ソート・空白無視で正規化する（フレームワーク間の表記揺れを吸収）。
# パースできない場合は __INVALID__ を出力する。
canon() {
  node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const sort = (x) =>
          Array.isArray(x) ? x.map(sort)
          : x && typeof x === "object"
            ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])]))
            : x;
        process.stdout.write(JSON.stringify(sort(JSON.parse(s))));
      } catch {
        process.stdout.write("__INVALID__");
      }
    });
  '
}

EXPECTED_CANON="$(printf '%s' "${EXPECTED_RAW}" | canon)"

# レスポンスボディが期待ペイロードと一致すれば 0 を返す。
verify_body() {
  local url="$1" body got
  body="$(curl -sf "${url}" 2>/dev/null)" || return 1
  got="$(printf '%s' "${body}" | canon)"
  [ "${got}" = "${EXPECTED_CANON}" ]
}

# "ラベル|URL" のリスト。先頭から順に計測する。
TARGETS=(
  "Elysia standalone (Node)|http://localhost:3001/"
  "Elysia standalone (Bun)|http://localhost:3002/"
  "Next.js native (Node)|http://localhost:3000/native"
  "Next.js + Elysia (Node)|http://localhost:3000/api"
  "TanStack Start native (Node)|http://localhost:3003/native"
  "TanStack Start + Elysia (Node)|http://localhost:3003/api"
  "Astro native (Node)|http://localhost:3004/native"
  "Astro + Elysia (Node)|http://localhost:3004/api"
  "AdonisJS native (Node)|http://localhost:3005/native"
  "AdonisJS + Elysia (Node)|http://localhost:3005/api"
  "SolidStart native (Node)|http://localhost:3006/native"
  "SolidStart + Elysia (Node)|http://localhost:3006/api"
  "SvelteKit native (Node)|http://localhost:3007/native"
  "SvelteKit + Elysia (Node)|http://localhost:3007/api"
  "Nuxt native (Node)|http://localhost:3008/native"
  "Nuxt + Elysia (Node)|http://localhost:3008/api"
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
  local out rate
  out="$(oha -z "${DURATION}" -c "${CONN}" --no-tui "${url}")"
  echo "${out}"

  # 計測結果が「正常に動いたうえでのもの」かを成功率で確認する。
  # 100% 未満なら（負荷時の接続失敗・5xx 等）結果は信頼できないので警告する。
  rate="$(printf '%s' "${out}" | grep -i 'Success rate:' | grep -oE '[0-9.]+%' | tr -d '%')"
  if [ -n "${rate}" ] && [ "${rate}" != "100.00" ]; then
    echo ">>> WARNING: ${name} の成功率が ${rate}% です。負荷時に失敗しています — この数値は無効。"
    echo ">>>          サーバの待受アドレス（localhost/IPv6 到達性）や実装を確認すること。"
  fi
  echo
}

# 到達でき、かつ期待レスポンスを返すエンドポイントだけを計測対象にする
echo "Checking endpoints (reachability + response body)..."
available=()
mismatch=0
for target in "${TARGETS[@]}"; do
  name="${target%%|*}"
  url="${target##*|}"
  if ! curl -sf "${url}" >/dev/null 2>&1; then
    echo "  [skip] ${name} (${url}) — 未起動"
  elif verify_body "${url}"; then
    echo "  [OK]   ${name} (${url})"
    available+=("${target}")
  else
    echo "  [NG]   ${name} (${url}) — レスポンスが期待ペイロードと不一致。計測から除外"
    mismatch=1
  fi
done
echo

if [ "${mismatch}" -ne 0 ]; then
  echo "WARNING: 期待と異なるレスポンスを返すエンドポイントがありました（上記 [NG]）。"
  echo "         該当サーバの実装を確認すること。計測は正常なエンドポイントのみで続行する。"
  echo
fi

if [ "${#available[@]}" -eq 0 ]; then
  echo "ERROR: 計測可能なエンドポイントがありません。サーバを起動してください。"
  exit 1
fi

for target in "${available[@]}"; do
  run_bench "${target%%|*}" "${target##*|}"
done
