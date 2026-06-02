import { createFileRoute } from "@tanstack/react-router"
import { payload } from "@elysia-bench/payload"

// Elysia を使わない素の TanStack Start server route。
// /api（Elysia 経由）と同じ共通ペイロードを返し、Elysia 連携のオーバーヘッドを比較する。
export const Route = createFileRoute("/native")({
  server: {
    handlers: {
      GET: () => Response.json(payload),
    },
  },
})
