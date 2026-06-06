import { runWorkload } from '@elysia-bench/workload'

// 素のネイティブ実装（Elysia なし・複雑ワークロード版）。
// Nitro が返り値のオブジェクトを JSON にシリアライズする。
export default defineEventHandler(() => runWorkload())
