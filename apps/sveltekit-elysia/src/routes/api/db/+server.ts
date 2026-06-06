import { Elysia } from 'elysia';
import { runWorkload } from '@elysia-bench/workload';
import type { RequestHandler } from './$types';

// Elysia 連携（prefix /api、route /db → /api/db）の複雑ワークロード版。
// SvelteKit の +server は Web Request を受け取れるので request をそのまま委譲する。
const app = new Elysia({ prefix: '/api' }).get('/db', () => runWorkload());

export const GET: RequestHandler = ({ request }) => app.handle(request);
