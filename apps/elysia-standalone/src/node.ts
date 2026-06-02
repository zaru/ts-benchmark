import { node } from "@elysiajs/node"
import { Elysia } from "elysia"
import { registerRoutes } from "./routes"

// Elysia 単体サーバ（Node ランタイム）。
// Next.js は Node でしか動かないため、Next.js 連携との比較用ベースライン。
registerRoutes(new Elysia({ adapter: node() })).listen(3001, () =>
  console.log("elysia-standalone [node] listening on http://localhost:3001"),
)
