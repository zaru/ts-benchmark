import express from "express"
import { payload } from "@elysia-bench/payload"
import { runWorkload } from "@elysia-bench/workload"

// Node 用・Bun 用のエントリで共通の Express アプリ定義。
// ランタイムだけを差し替えて公平に比較できるよう、ハンドラはここに一本化する。
//   GET /   … 単純な静的 JSON（従来）
//   GET /db … SQLite を複数回クエリしてアプリ側で集計する複雑ワークロード
export const app = express()
app.get("/", (_req, res) => {
  res.json(payload)
})
app.get("/db", async (_req, res) => {
  res.json(await runWorkload())
})
