import { serve } from "@hono/node-server"
import { app } from "./app.ts"

// Hono 単体サーバ（Node ランタイム）。Elysia 単体との比較用ベースライン。
// localhost(::1) でも負荷ツールから到達できるよう :: (デュアルスタック) で待ち受ける。
serve({ fetch: app.fetch, port: 3009, hostname: "::" }, () =>
  console.log("hono-standalone [node] listening on http://localhost:3009"),
)
