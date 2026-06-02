// TanStack Start (Vite) の本番ビルドは WinterTC 形式の fetch ハンドラを
// dist/server/server.js から default export する（自前で待受はしない）。
// TanStack Start が内部で利用する srvx でそのハンドラを Node 上で待ち受ける。
import { serve } from "srvx"
import handler from "../dist/server/server.js"

const port = Number(process.env.PORT ?? 3003)

serve({ fetch: handler.fetch, port })

console.log(`tanstack-elysia listening on http://localhost:${port}`)
