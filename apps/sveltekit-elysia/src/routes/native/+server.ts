import { payload } from '@elysia-bench/payload';
import type { RequestHandler } from './$types';

// 素のネイティブ実装（Elysia なし）
export const GET: RequestHandler = () => Response.json(payload);
