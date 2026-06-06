import { app } from "./app"

// Express 単体サーバ（Node ランタイム）。Elysia 単体との比較用ベースライン。
// localhost(::1) でも負荷ツールから到達できるよう :: (デュアルスタック) で待ち受ける。
app.listen(3010, "::", () =>
  console.log("express-standalone [node] listening on http://localhost:3010"),
)
