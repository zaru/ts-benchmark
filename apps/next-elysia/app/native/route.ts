import { payload } from "@elysia-bench/payload"

// Elysia を使わない素の Next.js Route Handler。
// /api（Elysia 経由）と同じ共通ペイロードを返し、Elysia 連携のオーバーヘッドを比較する。
export function GET() {
  return Response.json(payload)
}

// /api 側と条件を揃えるためキャッシュを無効化し毎回実行させる。
export const dynamic = "force-dynamic"
