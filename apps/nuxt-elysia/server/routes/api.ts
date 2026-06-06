import { Elysia } from 'elysia'
import { payload } from '@elysia-bench/payload'

// Elysia 連携（prefix /api、route / → /api）。
// Nitro/h3 のイベントを Web Request に変換して elysia.handle() に渡し、
// 返ってきた Web Response をそのまま返す（Nitro が Response を解釈して送出する）。
const app = new Elysia({ prefix: '/api' }).get('/', () => payload)

export default defineEventHandler((event) => app.handle(toWebRequest(event)))
