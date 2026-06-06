import { runWorkload } from "@elysia-bench/workload"

// Elysia を使わない素の Next.js Route Handler（複雑ワークロード版）。
// /api/db（Elysia 経由）と同じ集計結果を返し、Elysia 連携のオーバーヘッドを比較する。
export async function GET() {
  return Response.json(await runWorkload())
}

export const dynamic = "force-dynamic"
