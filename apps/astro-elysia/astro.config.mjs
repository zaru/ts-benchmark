import node from "@astrojs/node"
import { defineConfig } from "astro/config"

// https://astro.build/config
export default defineConfig({
  // server エンドポイント（Elysia）を本番でも動かすため SSR + Node アダプタ
  output: "server",
  adapter: node({ mode: "standalone" }),
  // Next.js(:3000)/Elysia(:3001,:3002)/TanStack(:3003) と同時起動できるよう :3004
  server: { port: 3004 },
  // better-sqlite3 はネイティブアドオンなので SSR バンドルから外し外部依存にする
  vite: { ssr: { external: ["better-sqlite3"] } },
})
