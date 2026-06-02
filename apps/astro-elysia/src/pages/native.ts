import { payload } from "@elysia-bench/payload"

// Elysia を使わない素の Astro Endpoint。
// /api（Elysia 経由）と同じ共通ペイロードを返し、Elysia 連携のオーバーヘッドを比較する。
export function GET() {
  return Response.json(payload)
}
