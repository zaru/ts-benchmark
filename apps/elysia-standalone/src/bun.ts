import { Elysia } from "elysia"
import { registerRoutes } from "./routes"

// Elysia 単体サーバ（Bun ランタイム）。
// アダプタを指定しなければ Elysia は Bun ネイティブ（本来の推奨環境）で動く。
// Node 版(:3001)・Next.js 版(:3000)と同時に立てられるよう別ポート(:3002)を使う。
registerRoutes(new Elysia()).listen(3002, () =>
  console.log("elysia-standalone [bun] listening on http://localhost:3002"),
)
