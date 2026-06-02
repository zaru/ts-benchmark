import { createFileRoute } from "@tanstack/react-router"
import { Elysia } from "elysia"
import { payload } from "@elysia-bench/payload"

// 公式の TanStack Start 連携手順どおり、prefix '/api' を付けた Elysia を
// server route の handlers にマウントする。GET /api で共通ペイロードを返す。
const app = new Elysia({ prefix: "/api" }).get("/", () => payload)

const handle = ({ request }: { request: Request }) => app.fetch(request)

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: handle,
    },
  },
})
