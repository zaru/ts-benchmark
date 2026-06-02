# elysia-bench

ElysiaJS のリクエスト性能を **「Elysia 単体（Node / Bun）」** と **「Next.js の Route Handler 上に Elysia を載せた連携構成」** で比較するベンチマーク。

## 比較の狙い

2 つの軸を分けて測定する。

1. **Next.js 経由のオーバーヘッド** — Next.js は Node でしか動かないため、公平性のために Elysia 単体も [`@elysiajs/node`](https://elysiajs.com/integrations/node.html) アダプタで **Node に揃え**、ランタイム差を排除したうえで「Next.js を通すことによる純粋なコスト」を測る。
2. **ランタイム差（Node vs Bun）** — 同じ Elysia 単体を Bun ネイティブでも動かし、Elysia 本来の推奨環境との差も見る。

全エンドポイントは同一の JSON オブジェクト（[`packages/payload`](packages/payload/index.ts)）を返す `GET` API で揃えてある。

| 構成 | URL | ランタイム | ポート | エントリ |
| --- | --- | --- | --- | --- |
| Elysia 単体 | `GET /` | Node | 3001 | [`src/node.ts`](apps/elysia-standalone/src/node.ts) |
| Elysia 単体 | `GET /` | Bun | 3002 | [`src/bun.ts`](apps/elysia-standalone/src/bun.ts) |
| Next.js + Elysia | `GET /api` | Node | 3000 | [`route.ts`](apps/next-elysia/app/api/[[...slugs]]/route.ts) |

Node 版と Bun 版はランタイムだけが異なり、ルート定義は [`src/routes.ts`](apps/elysia-standalone/src/routes.ts) に一本化している。

## 構成

```
apps/
  elysia-standalone/   Elysia 単体
    src/routes.ts      共通ルート定義（Node/Bun で共有）
    src/node.ts        Node エントリ（@elysiajs/node, port 3001）
    src/bun.ts         Bun エントリ（Bun ネイティブ, port 3002）
  next-elysia/         Next.js App Router + Elysia（port 3000）
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

計測したい対象を起動する。`bench/run.sh` は **起動しているエンドポイントだけ**を自動で計測するので、3 つ全部でも一部だけでもよい。

```bash
# 1) Elysia 単体（Node）
pnpm start:elysia

# 2) Elysia 単体（Bun）
pnpm start:elysia:bun

# 3) Next.js を本番ビルドして起動（dev モードは非代表的なので必ず build → start）
pnpm build:next
pnpm start:next

# 4) ベンチマーク実行
pnpm bench
```

動作確認（任意）:

```bash
curl http://localhost:3001/      # Elysia 単体 (Node)
curl http://localhost:3002/      # Elysia 単体 (Bun)
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

計測環境: macOS (Darwin 25.5.0, Apple Silicon) / Node 24.2.0 / Bun 1.3.14 / `CONN=50` / `DURATION=30s` / oha 1.14.0。
同一マシン上で負荷ツールとサーバを動かしているため、以下は**相対比較**として読むこと。

| 指標 | Elysia 単体 (Bun) | Elysia 単体 (Node) | Next.js + Elysia (Node) |
| --- | --- | --- | --- |
| Requests/sec | **72,913** | 43,848 | 5,200 |
| Latency 平均 | 0.68 ms | 1.14 ms | 9.61 ms |
| Latency p50 | 0.63 ms | 1.05 ms | 8.94 ms |
| Latency p95 | 1.18 ms | 1.54 ms | 13.03 ms |
| Latency p99 | 1.41 ms | 2.30 ms | 18.86 ms |

成功率はいずれも 100%（全レスポンス 200）。RPS を Bun=1.00 とした相対比は **Bun 1.00 : Node 0.60 : Next.js 0.071**。

### 考察

- **Next.js 経由のコスト（同一 Node ランタイム比）**: Elysia 単体(Node) → Next.js+Elysia(Node) でスループットは **約 1/8（8.4 倍遅い）**、レイテンシは約 8〜9 倍。これは Elysia 自体の処理コストではなく、**Next.js のリクエストパイプライン（ルーティング・`Request`/`Response` の Web 標準オブジェクト変換・各種ミドルウェア層）を 1 リクエストごとに通過するオーバーヘッド**が支配的であることを示す。
- **ランタイム差（Node vs Bun）**: 同じ Elysia 単体でも Bun は Node の **約 1.66 倍のスループット**。Elysia 本来の推奨環境である Bun が最速。
- **総合**: 最速の Elysia 単体(Bun) に対し Next.js+Elysia(Node) は約 1/14 のスループット。フロントと API を 1 リポジトリに同居させたい（Eden での型安全な連携を含む）開発体験上のメリットと、この性能差はトレードオフ。高スループットが要件なら Elysia を独立プロセス（できれば Bun）で立てる構成が有利。

## 留意点

- 計測は必ず Next.js を **本番ビルド**（`next build` → `next start`）で行う。dev モードは大幅に遅く非代表的。
- Route Handler は `export const dynamic = "force-dynamic"` でキャッシュを無効化し、リクエストごとに Elysia を実行させている（単体側と条件を揃えるため）。
- 負荷ツールとサーバを同一マシンで動かすため絶対値は環境依存。**相対比較**として読むこと。
