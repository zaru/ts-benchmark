import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  // better-sqlite3 はネイティブアドオンなのでバンドルせず外部依存として扱う
  vite: { ssr: { external: ["better-sqlite3"] } },
  server: { externals: { external: ["better-sqlite3"] } },
});
