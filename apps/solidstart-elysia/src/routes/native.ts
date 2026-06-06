import { payload } from "@elysia-bench/payload";

// 素のネイティブ実装（Elysia なし）
export function GET() {
  return Response.json(payload);
}
