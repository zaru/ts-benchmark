import type { Elysia } from "elysia"
import { payload } from "@elysia-bench/payload"

// Node 用・Bun 用のエントリで共通のルート定義。
// ランタイムだけを差し替えて公平に比較できるよう、ハンドラはここに一本化する。
export const registerRoutes = (app: Elysia) => app.get("/", () => payload)
