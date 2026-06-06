import { Elysia } from 'elysia';
import { payload } from '@elysia-bench/payload';
import type { RequestHandler } from './$types';

// Elysia 連携（prefix /api、route / → /api）。
// SvelteKit の +server は Web Request を受け取り Web Response を返せるので、
// 受け取った request をそのまま elysia.handle() に委譲する。
const app = new Elysia({ prefix: '/api' }).get('/', () => payload);

export const GET: RequestHandler = ({ request }) => app.handle(request);
