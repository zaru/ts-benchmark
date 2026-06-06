import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify"
import { AppModule } from "./app.module.js"

// NestJS 単体サーバ（@nestjs/platform-fastify）。Express アダプタとの差を測る。
// oha が localhost を ::1 に解決するため :: (デュアルスタック) で待ち受ける。
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
  { logger: false },
)
await app.listen(3014, "::")
console.log("nestjs-standalone [fastify] listening on http://localhost:3014")
