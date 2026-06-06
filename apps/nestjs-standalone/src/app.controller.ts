import { Controller, Get } from "@nestjs/common"
import { payload } from "@elysia-bench/payload"
import { runWorkload } from "@elysia-bench/workload"

// Express/Fastify どちらのアダプタでも共有するルート定義。
// DI を使わず（tsx は emitDecoratorMetadata 非対応のため）ハンドラ内で直接処理する。
//   GET /   … 単純な静的 JSON
//   GET /db … SQLite を複数回クエリしてアプリ側で集計する複雑ワークロード
@Controller()
export class AppController {
  @Get()
  index() {
    return payload
  }

  @Get("db")
  async db() {
    return runWorkload()
  }
}
