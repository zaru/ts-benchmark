import { node } from "@elysiajs/node"
import { Elysia } from "elysia"
import { payload } from "@elysia-bench/payload"

// Elysia 単体サーバ（Node ランタイム）。
// Next.js を経由しないベースライン。GET / で共通ペイロードを返す。
new Elysia({ adapter: node() })
  .get("/", () => payload)
  .listen(3001, () => console.log("elysia-standalone listening on http://localhost:3001"))
