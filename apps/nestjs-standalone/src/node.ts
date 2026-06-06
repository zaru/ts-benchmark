import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module.js"

// NestJS 単体サーバ（既定の @nestjs/platform-express）。Express 単体との比較で
// NestJS フレームワーク層のオーバーヘッドを切り出す。
// oha が localhost を ::1 に解決するため :: (デュアルスタック) で待ち受ける。
const app = await NestFactory.create(AppModule, { logger: false })
await app.listen(3013, "::")
console.log("nestjs-standalone [express] listening on http://localhost:3013")
