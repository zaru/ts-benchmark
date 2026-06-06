import { runWorkload } from '@elysia-bench/workload';
import type { RequestHandler } from './$types';

// 素のネイティブ実装（Elysia なし・複雑ワークロード版）
export const GET: RequestHandler = async () => Response.json(await runWorkload());
