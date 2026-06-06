import { runWorkload } from "@elysia-bench/workload";

// 素のネイティブ実装（Elysia なし・複雑ワークロード版）
export async function GET() {
  return Response.json(await runWorkload());
}
