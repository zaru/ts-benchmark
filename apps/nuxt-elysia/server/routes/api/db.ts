import { Elysia } from 'elysia'
import { runWorkload } from '@elysia-bench/workload'

// Elysia 連携（prefix /api、route /db → /api/db）の複雑ワークロード版。
// Nitro/h3 のイベントを Web Request に変換して elysia.handle() に渡す。
const app = new Elysia({ prefix: '/api' }).get('/db', () => runWorkload())

export default defineEventHandler((event) => app.handle(toWebRequest(event)))
