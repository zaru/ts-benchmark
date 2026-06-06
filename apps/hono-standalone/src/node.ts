import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { payload } from "@elysia-bench/payload"

// Hono 単体サーバ（Node ランタイム）。Elysia 単体との比較用ベースライン。
// localhost(::1) でも負荷ツールから到達できるよう :: (デュアルスタック) で待ち受ける。
const app = new Hono()
app.get("/", (c) => c.json(payload))

serve({ fetch: app.fetch, port: 3009, hostname: "::" }, () =>
  console.log("hono-standalone [node] listening on http://localhost:3009"),
)
