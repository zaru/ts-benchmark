import { app } from "./app"

// Hono 単体サーバ（Bun ランタイム）。Hono は Bun ネイティブの Bun.serve で動く。
// Elysia 単体(Bun) との比較用に、Node 版(:3009)とは別ポート(:3011)で待ち受ける。
// localhost(::1) でも負荷ツールから到達できるよう :: (デュアルスタック) で待ち受ける。
Bun.serve({ port: 3011, hostname: "::", fetch: app.fetch })
console.log("hono-standalone [bun] listening on http://localhost:3011")
