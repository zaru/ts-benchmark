import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // workspace 内の TS パッケージをトランスパイル対象にする
  transpilePackages: ["@elysia-bench/payload", "@elysia-bench/workload"],
  // better-sqlite3 はネイティブアドオンなのでバンドルせず外部依存として扱う
  serverExternalPackages: ["better-sqlite3"],
}

export default nextConfig
