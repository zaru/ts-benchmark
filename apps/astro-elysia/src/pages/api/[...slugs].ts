import { Elysia } from "elysia"
import { payload } from "@elysia-bench/payload"

// 公式の Astro 連携手順どおり、prefix '/api' を付けた Elysia を
// Astro Endpoint にマウントする。GET /api で共通ペイロードを返す。
const app = new Elysia({ prefix: "/api" }).get("/", () => payload)

const handle = ({ request }: { request: Request }) => app.handle(request)

export const GET = handle
