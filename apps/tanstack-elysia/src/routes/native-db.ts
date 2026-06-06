import { createFileRoute } from "@tanstack/react-router"
import { runWorkload } from "@elysia-bench/workload"

// Elysia を使わない素の TanStack Start server route（複雑ワークロード版）。
// /api/db（Elysia 経由）と同じ集計結果を返し、Elysia 連携のオーバーヘッドを比較する。
export const Route = createFileRoute("/native-db")({
  server: {
    handlers: {
      GET: async () => Response.json(await runWorkload()),
    },
  },
})
