import { createFileRoute } from "@tanstack/react-router"
import { Elysia } from "elysia"
import { payload } from "@elysia-bench/payload"
import { runWorkload } from "@elysia-bench/workload"

// 公式の TanStack Start 連携手順どおり、prefix '/api' を付けた Elysia を
// server route の handlers にマウントする。GET /api で共通ペイロードを返す。
//   GET /api/db … SQLite を複数回クエリしてアプリ側で集計する複雑ワークロード
const app = new Elysia({ prefix: "/api" })
  .get("/", () => payload)
  .get("/db", () => runWorkload())

const handle = ({ request }: { request: Request }) => app.fetch(request)

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: handle,
    },
  },
})
