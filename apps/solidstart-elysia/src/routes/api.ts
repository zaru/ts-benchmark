import type { APIEvent } from "@solidjs/start/server";
import { Elysia } from "elysia";
import { payload } from "@elysia-bench/payload";

// Elysia 連携（prefix /api、route / → /api）。
// SolidStart の API ルートは Web Request を受け取り Web Response を返せるので、
// event.request をそのまま elysia.handle() に委譲する。
const app = new Elysia({ prefix: "/api" }).get("/", () => payload);

export function GET(event: APIEvent) {
  return app.handle(event.request);
}
