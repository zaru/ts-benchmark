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
#   計測中は負荷時のピーク RSS（起動した pnpm プロセスツリー全体の合計）も記録し、
#   oha 出力の直後に "Peak RSS: XX.X MB" を出力する。フレームワーク間のメモリ比較用。
#   ※共有メモリを重複計上しうる総フットプリント値であり、フルスタックは累積ピークになる
#     （詳細は README の注記を参照）。
#
#   パラメータは環境変数で上書き可能:
#     DURATION       計測時間         (default 30s)
#     CONN           同時接続数       (default 50)
#     WARMUP         ウォームアップ時間 (default 5s)
#     READY_TIMEOUT  起動待ちの上限秒  (default 60)
#     MEM_INTERVAL   RSS サンプリング間隔・秒 (default 0.5)

DURATION="${DURATION:-30s}"
CONN="${CONN:-50}"
WARMUP="${WARMUP:-5s}"
READY_TIMEOUT="${READY_TIMEOUT:-60}"
MEM_INTERVAL="${MEM_INTERVAL:-0.5}"

# 複雑ワークロード用 SQLite の絶対パス。各アプリ（特にバンドルされる full-stack）が
# import.meta.url 由来の相対解決に依存せず同じ DB を読めるよう、ここで固定して渡す。
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export WORKLOAD_DB_PATH="${ROOT_DIR}/packages/workload/workload.sqlite"

# 単純エンドポイント（/ ・/native ・/api）が返すべき共通ペイロード（packages/payload と一致）
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

# 複雑エンドポイント（/db 系）の期待値は共有パッケージの runWorkload() から動的生成する。
# 全アプリが同一の決定的出力を返す前提なので、これと突き合わせれば「アプリ間で出力が割れて
# いないか／DB 未シード／Node・Bun でドライバ出力差が出ていないか」を検知できる。
EXPECTED_DB_CANON="$(npx tsx "${ROOT_DIR}/packages/workload/print-expected.ts" 2>/dev/null | canon)"
if [ -z "${EXPECTED_DB_CANON}" ] || [ "${EXPECTED_DB_CANON}" = "__INVALID__" ]; then
  echo "ERROR: 複雑ワークロードの期待値を生成できませんでした。"
  echo "       'pnpm --filter @elysia-bench/workload seed' で workload.sqlite を生成したか確認してください。"
  exit 1
fi

# レスポンスボディが指定した期待ペイロード（第2引数）と一致すれば 0 を返す。
verify_body() {
  local url="$1" expected="$2" body got
  body="$(curl -sf "${url}" 2>/dev/null)" || return 1
  got="$(printf '%s' "${body}" | canon)"
  [ "${got}" = "${expected}" ]
}

# 計測対象の定義: "起動スクリプト|ポート|エンドポイント定義"
#   エンドポイント定義 = "ラベル::パス::期待値キー" を ';' で連結（同一サーバで列挙）
#   期待値キー: payload=単純な共通 JSON / db=複雑ワークロードの集計結果
APPS=(
  "start:elysia|3001|Elysia standalone (Node)::/::payload;Elysia standalone DB (Node)::/db::db"
  "start:elysia:bun|3002|Elysia standalone (Bun)::/::payload;Elysia standalone DB (Bun)::/db::db"
  "start:hono|3009|Hono standalone (Node)::/::payload;Hono standalone DB (Node)::/db::db"
  "start:hono:bun|3011|Hono standalone (Bun)::/::payload;Hono standalone DB (Bun)::/db::db"
  "start:express|3010|Express standalone (Node)::/::payload;Express standalone DB (Node)::/db::db"
  "start:express:bun|3012|Express standalone (Bun)::/::payload;Express standalone DB (Bun)::/db::db"
  "start:nestjs|3013|NestJS standalone Express (Node)::/::payload;NestJS standalone Express DB (Node)::/db::db"
  "start:nestjs:fastify|3014|NestJS standalone Fastify (Node)::/::payload;NestJS standalone Fastify DB (Node)::/db::db"
  "start:next|3000|Next.js native (Node)::/native::payload;Next.js + Elysia (Node)::/api::payload;Next.js native DB (Node)::/native-db::db;Next.js + Elysia DB (Node)::/api/db::db"
  "start:tanstack|3003|TanStack Start native (Node)::/native::payload;TanStack Start + Elysia (Node)::/api::payload;TanStack Start native DB (Node)::/native-db::db;TanStack Start + Elysia DB (Node)::/api/db::db"
  "start:astro|3004|Astro native (Node)::/native::payload;Astro + Elysia (Node)::/api::payload;Astro native DB (Node)::/native-db::db;Astro + Elysia DB (Node)::/api/db::db"
  "start:adonis|3005|AdonisJS native (Node)::/native::payload;AdonisJS + Elysia (Node)::/api::payload;AdonisJS native DB (Node)::/native-db::db;AdonisJS + Elysia DB (Node)::/api/db::db"
  "start:solid|3006|SolidStart native (Node)::/native::payload;SolidStart + Elysia (Node)::/api::payload;SolidStart native DB (Node)::/native-db::db;SolidStart + Elysia DB (Node)::/api/db::db"
  "start:svelte|3007|SvelteKit native (Node)::/native::payload;SvelteKit + Elysia (Node)::/api::payload;SvelteKit native DB (Node)::/native-db::db;SvelteKit + Elysia DB (Node)::/api/db::db"
  "start:nuxt|3008|Nuxt native (Node)::/native::payload;Nuxt + Elysia (Node)::/api::payload;Nuxt native DB (Node)::/native-db::db;Nuxt + Elysia DB (Node)::/api/db::db"
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

# 指定 PID とその全子孫の PID を列挙する（自身を含む）。
#   pnpm は `pnpm → sh -c "node ..." → node` のように中間シェルを挟むため、必ず再帰で
#   辿りきる。単層 `pgrep -P` だと中間 sh しか拾えず RSS がほぼ 0 になる。
tree_pids() {
  local root="$1" kid
  echo "${root}"
  for kid in $(pgrep -P "${root}" 2>/dev/null); do
    tree_pids "${kid}"
  done
}

# 指定 PID のプロセスツリー全体の RSS(KiB) を合計して出力する。
#   macOS の `ps -o rss=` は KiB 単位。共有メモリを各プロセスで重複計上しうる総フットプリント。
tree_rss_kb() {
  local root="$1" pids
  pids="$(tree_pids "${root}" | paste -sd, -)"
  [ -n "${pids}" ] || { echo 0; return; }
  ps -o rss= -p "${pids}" 2>/dev/null | awk '{s+=$1} END {print s+0}'
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
  local name="$1" url="$2" out rate peak_file sampler_pid peak_kb
  echo "============================================================"
  echo " ${name}"
  echo " URL: ${url} / conn=${CONN} / duration=${DURATION}"
  echo "============================================================"

  echo "--- warmup (${WARMUP}) ---"
  oha -z "${WARMUP}" -c "${CONN}" --no-tui "${url}" >/dev/null 2>&1

  echo "--- measure (${DURATION}) ---"
  # 計測中に起動中サーバ（pnpm ツリー全体）の RSS を定期サンプリングし、ピークを記録する。
  # サブシェルはフォーク時点の LAUNCHER_PID を参照する（計測中は不変なので問題なし）。
  peak_file="$(mktemp)"
  (
    peak=0
    while :; do
      cur="$(tree_rss_kb "${LAUNCHER_PID}")"
      [ "${cur:-0}" -gt "${peak}" ] && peak="${cur}"
      echo "${peak}" >"${peak_file}"
      sleep "${MEM_INTERVAL}"
    done
  ) &
  sampler_pid=$!

  out="$(oha -z "${DURATION}" -c "${CONN}" --no-tui "${url}")"
  echo "${out}"

  kill "${sampler_pid}" 2>/dev/null
  wait "${sampler_pid}" 2>/dev/null
  peak_kb="$(cat "${peak_file}" 2>/dev/null || echo 0)"
  rm -f "${peak_file}"

  # 計測結果が「正常に動いたうえでのもの」かを成功率で確認する。
  rate="$(printf '%s' "${out}" | grep -i 'Success rate:' | grep -oE '[0-9.]+%' | tr -d '%')"
  if [ -n "${rate}" ] && [ "${rate}" != "100.00" ]; then
    echo ">>> WARNING: ${name} の成功率が ${rate}% です。負荷時に失敗しています — この数値は無効。"
    echo ">>>          サーバの待受アドレス（localhost/IPv6 到達性）や実装を確認すること。"
  fi

  echo "--- peak RSS (process tree) ---"
  awk "BEGIN { printf \"Peak RSS: %.1f MB\n\", ${peak_kb:-0} / 1024 }"
  echo
}

measured=0
mismatch=0
for app in "${APPS[@]}"; do
  IFS='|' read -r script port endpoints <<<"${app}"
  IFS=';' read -ra eps <<<"${endpoints}"
  # eps[0] = "ラベル::パス::キー"。疎通待ちには先頭エンドポイントのパスを使う。
  first_rest="${eps[0]#*::}"
  first_path="${first_rest%%::*}"

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
    # ep = "ラベル::パス::キー"
    elabel="${ep%%::*}"
    erest="${ep#*::}"
    epath="${erest%%::*}"
    ekey="${erest##*::}"
    url="http://localhost:${port}${epath}"
    case "${ekey}" in
      db) expected="${EXPECTED_DB_CANON}" ;;
      *) expected="${EXPECTED_CANON}" ;;
    esac
    if verify_body "${url}" "${expected}"; then
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
