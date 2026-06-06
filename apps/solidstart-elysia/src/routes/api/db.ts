import type { APIEvent } from "@solidjs/start/server";
import { Elysia } from "elysia";
import { runWorkload } from "@elysia-bench/workload";

// Elysia 連携（prefix /api、route /db → /api/db）の複雑ワークロード版。
// SolidStart の API ルートは Web Request を受け取れるので event.request を委譲する。
const app = new Elysia({ prefix: "/api" }).get("/db", () => runWorkload());

export function GET(event: APIEvent) {
  return app.handle(event.request);
}
