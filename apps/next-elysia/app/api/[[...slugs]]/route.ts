import { Elysia } from "elysia"
import { payload } from "@elysia-bench/payload"
import { runWorkload } from "@elysia-bench/workload"

// 公式の Next.js 連携手順どおり、prefix '/api' を付けた Elysia を
// catch-all Route Handler に載せ、Elysia.fetch を HTTP メソッドとして export する。
//   GET /api/db … SQLite を複数回クエリしてアプリ側で集計する複雑ワークロード
const app = new Elysia({ prefix: "/api" })
  .get("/", () => payload)
  .get("/db", () => runWorkload())

export const GET = app.fetch

// 計測の公平性のため Route Handler のキャッシュを無効化し、毎回 Elysia を実行させる
// （Elysia 単体側もリクエストごとに実行するため条件を揃える）。
export const dynamic = "force-dynamic"
