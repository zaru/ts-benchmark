#!/usr/bin/env bash
set -uo pipefail

# ElysiaJS リクエストベンチマーク（逐次計測ドライバ）
#
#   各アプリを「起動 → 疎通待ち → レスポンス検証 → ウォームアップ → 計測 → 停止」の順に
#   1 つずつ処理する。常に計測対象 1 アプリだけを起動するので、アイドルなサーバが RAM を
#   占有しない。native と +Elysia は同一サーバを起動したまま連続で計測する。
#
#   事前に各フレームワークを本番ビルドしておくこと（単体サーバ tsx 系はビルド不要）:
#     pnpm build:next && pnpm build:tanstack && pnpm build:astro \
#       && pnpm build:adonis && pnpm build:solid && pnpm build:svelte && pnpm build:nuxt
#   そのうえで:
#     pnpm bench
#
#   ビルドし忘れた／起動できないアプリは [skip] される（他は継続）。
#
#   計測前に各エンドポイントのレスポンスが期待ペイロードと一致するかを検証し、
#   計測後に oha の成功率が 100% かも確認する（正常に動いたうえでの計測を担保）。
#
#   パラメータは環境変数で上書き可能:
#     DURATION       計測時間         (default 30s)
#     CONN           同時接続数       (default 50)
#     WARMUP         ウォームアップ時間 (default 5s)
#     READY_TIMEOUT  起動待ちの上限秒  (default 60)

DURATION="${DURATION:-30s}"
CONN="${CONN:-50}"
WARMUP="${WARMUP:-5s}"
READY_TIMEOUT="${READY_TIMEOUT:-60}"

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

# 計測対象の定義: "起動スクリプト|ポート|エンドポイント定義"
#   エンドポイント定義 = "ラベル::パス" を ';' で連結（native と +Elysia を同一サーバで列挙）
APPS=(
  "start:elysia|3001|Elysia standalone (Node)::/"
  "start:elysia:bun|3002|Elysia standalone (Bun)::/"
  "start:hono|3009|Hono standalone (Node)::/"
  "start:express|3010|Express standalone (Node)::/"
  "start:next|3000|Next.js native (Node)::/native;Next.js + Elysia (Node)::/api"
  "start:tanstack|3003|TanStack Start native (Node)::/native;TanStack Start + Elysia (Node)::/api"
  "start:astro|3004|Astro native (Node)::/native;Astro + Elysia (Node)::/api"
  "start:adonis|3005|AdonisJS native (Node)::/native;AdonisJS + Elysia (Node)::/api"
  "start:solid|3006|SolidStart native (Node)::/native;SolidStart + Elysia (Node)::/api"
  "start:svelte|3007|SvelteKit native (Node)::/native;SvelteKit + Elysia (Node)::/api"
  "start:nuxt|3008|Nuxt native (Node)::/native;Nuxt + Elysia (Node)::/api"
)

LAUNCHER_PID=""
CURRENT_PORT=""

# 指定ポートを listen しているプロセスを落とす（pnpm → node の子も含めて確実に止める）。
free_port() {
  local port="$1" pids
  pids="$(lsof -ti tcp:"${port}" 2>/dev/null || true)"
  [ -n "${pids}" ] && kill ${pids} 2>/dev/null
  return 0
}

stop_server() {
  local port="$1" pids tries=0
  [ -n "${port}" ] || return 0
  [ -n "${LAUNCHER_PID}" ] && kill "${LAUNCHER_PID}" 2>/dev/null
  pids="$(lsof -ti tcp:"${port}" 2>/dev/null || true)"
  [ -n "${pids}" ] && kill ${pids} 2>/dev/null
  while lsof -ti tcp:"${port}" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "${tries}" -gt 20 ]; then
      pids="$(lsof -ti tcp:"${port}" 2>/dev/null || true)"
      [ -n "${pids}" ] && kill -9 ${pids} 2>/dev/null
      break
    fi
    sleep 0.5
  done
  LAUNCHER_PID=""
}

# 中断時も起動中サーバを確実に停止する
cleanup() { stop_server "${CURRENT_PORT}"; }
trap cleanup EXIT INT TERM

wait_ready() {
  local url="$1" waited=0
  until curl -sf "${url}" >/dev/null 2>&1; do
    waited=$((waited + 1))
    if [ "${waited}" -gt $((READY_TIMEOUT * 2)) ]; then return 1; fi
    sleep 0.5
  done
}

run_bench() {
  local name="$1" url="$2" out rate
  echo "============================================================"
  echo " ${name}"
  echo " URL: ${url} / conn=${CONN} / duration=${DURATION}"
  echo "============================================================"

  echo "--- warmup (${WARMUP}) ---"
  oha -z "${WARMUP}" -c "${CONN}" --no-tui "${url}" >/dev/null 2>&1

  echo "--- measure (${DURATION}) ---"
  out="$(oha -z "${DURATION}" -c "${CONN}" --no-tui "${url}")"
  echo "${out}"

  # 計測結果が「正常に動いたうえでのもの」かを成功率で確認する。
  rate="$(printf '%s' "${out}" | grep -i 'Success rate:' | grep -oE '[0-9.]+%' | tr -d '%')"
  if [ -n "${rate}" ] && [ "${rate}" != "100.00" ]; then
    echo ">>> WARNING: ${name} の成功率が ${rate}% です。負荷時に失敗しています — この数値は無効。"
    echo ">>>          サーバの待受アドレス（localhost/IPv6 到達性）や実装を確認すること。"
  fi
  echo
}

measured=0
mismatch=0
for app in "${APPS[@]}"; do
  IFS='|' read -r script port endpoints <<<"${app}"
  IFS=';' read -ra eps <<<"${endpoints}"
  first_path="${eps[0]##*::}"

  echo "############################################################"
  echo "# ${script} を起動 (:${port})"
  echo "############################################################"

  free_port "${port}"
  CURRENT_PORT="${port}"
  pnpm "${script}" >"/tmp/bench-${port}.log" 2>&1 &
  LAUNCHER_PID=$!

  if ! wait_ready "http://localhost:${port}${first_path}"; then
    echo "  [skip] ${script} を起動できませんでした（未ビルド？ ログ: /tmp/bench-${port}.log）"
    stop_server "${port}"
    CURRENT_PORT=""
    echo
    continue
  fi

  for ep in "${eps[@]}"; do
    elabel="${ep%%::*}"
    epath="${ep##*::}"
    url="http://localhost:${port}${epath}"
    if verify_body "${url}"; then
      echo "  [OK] ${elabel} のレスポンスを検証 → 計測"
      run_bench "${elabel}" "${url}"
      measured=$((measured + 1))
    else
      echo "  [NG] ${elabel} (${url}) — レスポンスが期待ペイロードと不一致。計測スキップ"
      mismatch=1
      echo
    fi
  done

  stop_server "${port}"
  CURRENT_PORT=""
done

trap - EXIT INT TERM

if [ "${mismatch}" -ne 0 ]; then
  echo "WARNING: 期待と異なるレスポンスを返したエンドポイントがありました（上記 [NG]）。実装を確認すること。"
fi

if [ "${measured}" -eq 0 ]; then
  echo "ERROR: 計測できたエンドポイントがありません。各フレームワークをビルドしてあるか確認してください。"
  exit 1
fi
