# elysia-bench

ElysiaJS のリクエスト性能を **「Elysia 単体」** と **「Next.js の Route Handler 上に Elysia を載せた連携構成」** で比較するベンチマーク。

## 比較の狙い

Next.js は Node でしか動かないため、公平性を保つために **両方とも Node.js ランタイム上で動かす**（Elysia 単体も [`@elysiajs/node`](https://elysiajs.com/integrations/node.html) アダプタを使う）。これによりランタイム差を排除し、**「Next.js を経由することによる純粋なオーバーヘッド」** を測定する。

両エンドポイントは同一の JSON オブジェクト（[`packages/payload`](packages/payload/index.ts)）を返す `GET` API で揃えてある。

| 構成 | URL | ランタイム | ポート |
| --- | --- | --- | --- |
| Elysia 単体 | `GET /` | Node | 3001 |
| Next.js + Elysia | `GET /api` | Node | 3000 |

## 構成

```
apps/
  elysia-standalone/   Elysia 単体（@elysiajs/node, port 3001）
  next-elysia/         Next.js App Router + Elysia（port 3000）
packages/
  payload/             両者が返す共通 JSON ペイロード
bench/
  run.sh               oha でウォームアップ→計測
```

## セットアップ

```bash
pnpm install
```

## 実行手順

ターミナルを 3 つ使う。

```bash
# 1) Elysia 単体を起動
pnpm start:elysia

# 2) Next.js を本番ビルドして起動（dev モードは非代表的なので必ず build → start）
pnpm build:next
pnpm start:next

# 3) ベンチマーク実行
pnpm bench
```

動作確認（任意）:

```bash
curl http://localhost:3001/      # Elysia 単体
curl http://localhost:3000/api   # Next.js + Elysia
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

計測環境: macOS (Darwin 25.5.0, Apple Silicon) / Node 24.2.0 / `CONN=50` / `DURATION=30s` / oha 1.14.0。
同一マシン上で負荷ツールとサーバを動かしているため、以下は**相対比較**として読むこと。

| 指標 | Elysia 単体 | Next.js + Elysia | Next.js のコスト |
| --- | --- | --- | --- |
| Requests/sec | 44,649 | 5,400 | **約 1/8（8.3倍遅い）** |
| Latency 平均 | 1.12 ms | 9.26 ms | +8.1 ms |
| Latency p50 | 1.04 ms | 8.78 ms | 約 8.4 倍 |
| Latency p95 | 1.42 ms | 12.05 ms | 約 8.5 倍 |
| Latency p99 | 2.22 ms | 17.46 ms | 約 7.9 倍 |

成功率はどちらも 100%（全レスポンス 200）。

### 考察

- 同一の Node ランタイム・同一ペイロードで揃えても、Next.js の Route Handler を経由すると **スループットは約 1/8、レイテンシは約 8 倍** になる。
- これは Elysia 自体の処理コストではなく、**Next.js のリクエストパイプライン（ルーティング・`Request`/`Response` の Web 標準オブジェクト変換・各種ミドルウェア層）を 1 リクエストごとに通過するオーバーヘッド**が支配的であることを示す。
- フロントエンドと API を 1 リポジトリに同居させたい（Eden での型安全な連携を含む）といった開発体験上のメリットと、この性能差はトレードオフ。高スループットが要件なら Elysia を独立プロセスとして立てる構成が有利。

## 留意点

- 計測は必ず Next.js を **本番ビルド**（`next build` → `next start`）で行う。dev モードは大幅に遅く非代表的。
- Route Handler は `export const dynamic = "force-dynamic"` でキャッシュを無効化し、リクエストごとに Elysia を実行させている（単体側と条件を揃えるため）。
- 負荷ツールとサーバを同一マシンで動かすため絶対値は環境依存。**相対比較**として読むこと。
