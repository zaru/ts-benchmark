# elysia-bench

ElysiaJS のリクエスト性能を **「Elysia 単体（Node / Bun）」** と **「Next.js / TanStack Start / Astro との連携」** で比較するベンチマーク。各フレームワークでは **素のネイティブ実装（Elysia なし）** と **Elysia 連携** の両方を用意し、Elysia を載せることによる差も測る。

## 比較の狙い

3 つの軸を分けて測定する。

1. **フレームワーク経由のオーバーヘッド** — Next.js / TanStack Start / Astro はいずれも Node で動かすため、公平性のために Elysia 単体も [`@elysiajs/node`](https://elysiajs.com/integrations/node.html) アダプタで **Node に揃え**、ランタイム差を排除したうえで「各フレームワークのサーバルートに API を載せることによる純粋なコスト」を測る。
2. **ランタイム差（Node vs Bun）** — 同じ Elysia 単体を Bun ネイティブでも動かし、Elysia 本来の推奨環境との差も見る。
3. **Elysia 連携のオーバーヘッド** — 各フレームワークで「素のネイティブ実装 `/native`」と「Elysia 連携 `/api`」を**同一サーバ・同一ランタイム**で公開し、Elysia を載せた差だけを切り出す。

全エンドポイントは同一の JSON オブジェクト（[`packages/payload`](packages/payload/index.ts)）を返す `GET` API で揃えてある。

| 構成 | URL | ランタイム | ポート | エントリ |
| --- | --- | --- | --- | --- |
| Elysia 単体 | `GET /` | Node | 3001 | [`src/node.ts`](apps/elysia-standalone/src/node.ts) |
| Elysia 単体 | `GET /` | Bun | 3002 | [`src/bun.ts`](apps/elysia-standalone/src/bun.ts) |
| Next.js native | `GET /native` | Node | 3000 | [`native/route.ts`](apps/next-elysia/app/native/route.ts) |
| Next.js + Elysia | `GET /api` | Node | 3000 | [`route.ts`](apps/next-elysia/app/api/[[...slugs]]/route.ts) |
| TanStack Start native | `GET /native` | Node | 3003 | [`native.ts`](apps/tanstack-elysia/src/routes/native.ts) |
| TanStack Start + Elysia | `GET /api` | Node | 3003 | [`api.$.ts`](apps/tanstack-elysia/src/routes/api.$.ts) |
| Astro native | `GET /native` | Node | 3004 | [`native.ts`](apps/astro-elysia/src/pages/native.ts) |
| Astro + Elysia | `GET /api` | Node | 3004 | [`[...slugs].ts`](apps/astro-elysia/src/pages/api/[...slugs].ts) |

Node 版と Bun 版はランタイムだけが異なり、ルート定義は [`src/routes.ts`](apps/elysia-standalone/src/routes.ts) に一本化している。

## 構成

```
apps/
  elysia-standalone/   Elysia 単体
    src/routes.ts      共通ルート定義（Node/Bun で共有）
    src/node.ts        Node エントリ（@elysiajs/node, port 3001）
    src/bun.ts         Bun エントリ（Bun ネイティブ, port 3002）
  next-elysia/         Next.js App Router（port 3000）
    app/native/route.ts          素の Route Handler（Elysia なし）
    app/api/[[...slugs]]/route.ts  Elysia をマウント
  tanstack-elysia/     TanStack Start（port 3003）
    src/routes/native.ts  素の server route（Elysia なし）
    src/routes/api.$.ts   Elysia をマウント
    server/prod.mjs       本番ビルドの fetch ハンドラを srvx で待受
  astro-elysia/        Astro（port 3004）
    src/pages/native.ts           素の Astro Endpoint（Elysia なし）
    src/pages/api/[...slugs].ts   Elysia をマウント
    astro.config.mjs     output:server + @astrojs/node(standalone)
packages/
  payload/             全エンドポイントが返す共通 JSON ペイロード
bench/
  run.sh               oha でウォームアップ→計測（起動中の対象だけ自動計測）
```

## セットアップ

```bash
pnpm install
```

## 実行手順

計測したい対象を起動する。`bench/run.sh` は **起動しているエンドポイントだけ**を自動で計測するので、全部でも一部だけでもよい。

```bash
# 1) Elysia 単体（Node）
pnpm start:elysia

# 2) Elysia 単体（Bun）
pnpm start:elysia:bun

# 3) Next.js を本番ビルドして起動（dev モードは非代表的なので必ず build → start）
pnpm build:next
pnpm start:next

# 4) TanStack Start を本番ビルドして起動（同上）
pnpm build:tanstack
pnpm start:tanstack

# 5) Astro を本番ビルドして起動（同上）
pnpm build:astro
pnpm start:astro

# 6) ベンチマーク実行
pnpm bench
```

動作確認（任意）:

```bash
curl http://localhost:3001/         # Elysia 単体 (Node)
curl http://localhost:3002/         # Elysia 単体 (Bun)
curl http://localhost:3000/native   # Next.js native      / curl .../api    # + Elysia
curl http://localhost:3003/native   # TanStack native     / curl .../api    # + Elysia
curl http://localhost:3004/native   # Astro native        / curl .../api    # + Elysia
```

### パラメータ

`bench/run.sh` は環境変数で調整できる。

| 変数 | デフォルト | 説明 |
| --- | --- | --- |
| `DURATION` | `30s` | 計測時間 |
| `CONN` | `50` | 同時接続数 |
| `WARMUP` | `5s` | ウォームアップ時間 |

```bash
DURATION=60s CONN=100 pnpm bench
```

## 結果

計測環境: macOS (Darwin 25.5.0, Apple Silicon) / Node 24.2.0 / Bun 1.3.14 / `CONN=50` / `DURATION=30s` / oha 1.14.0。
8 つを**同時起動して同一 run で**計測したもの（負荷ツールも同一マシン）。絶対値は環境依存なので**相対比較**として読むこと。

| 構成 | Requests/sec | 平均 ms | p50 ms | p99 ms |
| --- | --- | --- | --- | --- |
| Elysia 単体 (Bun) | **72,663** | 0.69 | 0.62 | 1.57 |
| Elysia 単体 (Node) | 46,274 | 1.08 | 1.02 | 2.12 |
| TanStack Start native | 22,562 | 2.21 | 2.01 | 4.72 |
| TanStack Start + Elysia | 21,824 | 2.29 | 2.07 | 5.29 |
| Astro native | 12,226 | 4.09 | 3.79 | 9.44 |
| Astro + Elysia | 11,612 | 4.30 | 3.98 | 9.87 |
| Next.js native | 5,681 | 8.80 | 7.71 | 26.30 |
| Next.js + Elysia | 5,272 | 9.48 | 8.72 | 19.45 |

成功率はいずれも 100%（全レスポンス 200）。

#### Elysia 連携のオーバーヘッド（native → +Elysia、同一サーバ）

| フレームワーク | native RPS | +Elysia RPS | Elysia 維持率 |
| --- | --- | --- | --- |
| TanStack Start | 22,562 | 21,824 | **96.7%**（約 -3%） |
| Astro | 12,226 | 11,612 | **95.0%**（約 -5%） |
| Next.js | 5,681 | 5,272 | **92.8%**（約 -7%） |

→ **Elysia を載せても素の状態から 3〜7% 程度しか落ちない**。スループットの大きな差はフレームワーク側が支配的で、Elysia のオーバーヘッドは小さい。

#### スループット（Requests/sec、高いほど良い）

```mermaid
xychart-beta
    title "Requests/sec (higher is better)"
    x-axis ["Elysia(Bun)", "Elysia(Node)", "TanStack native", "TanStack+Elysia", "Astro native", "Astro+Elysia", "Next native", "Next+Elysia"]
    y-axis "Requests/sec" 0 --> 75000
    bar [72663, 46274, 22562, 21824, 12226, 11612, 5681, 5272]
```

#### レイテンシ p50（ms、低いほど良い）

```mermaid
xychart-beta
    title "Latency p50 (ms, lower is better)"
    x-axis ["Elysia(Bun)", "Elysia(Node)", "TanStack native", "TanStack+Elysia", "Astro native", "Astro+Elysia", "Next native", "Next+Elysia"]
    y-axis "ms" 0 --> 9
    bar [0.62, 1.02, 2.01, 2.07, 3.79, 3.98, 7.71, 8.72]
```

#### レイテンシ p99（ms、低いほど良い）

```mermaid
xychart-beta
    title "Latency p99 (ms, lower is better)"
    x-axis ["Elysia(Bun)", "Elysia(Node)", "TanStack native", "TanStack+Elysia", "Astro native", "Astro+Elysia", "Next native", "Next+Elysia"]
    y-axis "ms" 0 --> 27
    bar [1.57, 2.12, 4.72, 5.29, 9.44, 9.87, 26.30, 19.45]
```

### 考察

- **Elysia 連携のオーバーヘッドは小さい（今回の主目的）**: 各フレームワークで素のネイティブ実装に Elysia を載せても、スループットは **3〜7% 落ちる程度**（TanStack -3% / Astro -5% / Next.js -7%）。p50 レイテンシの増分も 0.1〜1.0ms 程度。つまり「Elysia を使うかどうか」より「どのフレームワークに載せるか」が性能を支配する。
- **フレームワーク経由のコスト（同一 Node ランタイム比）**: Elysia 単体(Node) を基準にスループットを見ると、TanStack ≒ 0.47 倍、Astro ≒ 0.25 倍、Next.js ≒ 0.11 倍。同じ Node 上でも **TanStack > Astro > Next.js** とリクエストパイプラインの重さで明確に差が出る。Astro はちょうど中間。Next.js の Route Handler 層（`Request`/`Response` 変換・各種ミドルウェア・キャッシュ判定など）が相対的に最も重い。
- **ランタイム差（Node vs Bun）**: 同じ Elysia 単体でも Bun は Node の **約 1.6 倍のスループット**。Elysia 本来の推奨環境である Bun が最速。
- **総合**: 最速の Elysia 単体(Bun) を 100% とすると Node 単体 ≒ 64%、TanStack 連携 ≒ 30%、Astro 連携 ≒ 16%、Next.js 連携 ≒ 7.3%。フルスタック連携しつつ API 性能も重視するなら **TanStack Start が最有利**。純粋な API スループットが最優先なら Elysia を独立プロセス（できれば Bun）で立てる構成が最良。

> 注: 上表は 8 エンドポイント同時起動・同一マシンでの相対比較のため、各 RPS は単独計測時より低めに出る可能性がある（リソース競合）。比較は同条件なので有効。Next.js native の p99 が +Elysia より高いのは、同一マシン同時計測時のばらつき（テールの揺れ）の範囲。

## 留意点

- 計測は必ず Next.js / TanStack Start / Astro を **本番ビルド**で行う（`build:*` → `start:*`）。dev モードは大幅に遅く非代表的。
- Next.js の Route Handler は `export const dynamic = "force-dynamic"` でキャッシュを無効化し、リクエストごとに Elysia を実行させている（単体側と条件を揃えるため）。
- TanStack Start の Vite ビルドは WinterTC 形式の `fetch` ハンドラを出力するだけなので、本番起動は TanStack が内部利用する [`srvx`](https://github.com/h3js/srvx) で待ち受ける（[`server/prod.mjs`](apps/tanstack-elysia/server/prod.mjs)）。
- Astro は `output: 'server'` + [`@astrojs/node`](https://docs.astro.build/en/guides/integrations-guide/node/)（standalone）で SSR エンドポイントを本番起動する。
- 負荷ツールとサーバを同一マシンで動かすため絶対値は環境依存。**相対比較**として読むこと。
