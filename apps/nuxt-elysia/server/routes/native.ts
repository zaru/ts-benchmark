import { payload } from '@elysia-bench/payload'

// 素のネイティブ実装（Elysia なし）。Nitro がオブジェクトを JSON にシリアライズする。
export default defineEventHandler(() => payload)
