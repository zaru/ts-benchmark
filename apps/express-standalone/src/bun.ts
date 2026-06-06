import { app } from "./app"

// Express 単体サーバ（Bun ランタイム）。Express(5) は Bun の Node 互換 API でそのまま動く。
// Elysia 単体(Bun) との比較用に、Node 版(:3010)とは別ポート(:3012)で待ち受ける。
// localhost(::1) でも負荷ツールから到達できるよう :: (デュアルスタック) で待ち受ける。
app.listen(3012, "::", () =>
  console.log("express-standalone [bun] listening on http://localhost:3012"),
)
