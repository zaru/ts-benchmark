import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // workspace 内の TS パッケージ(@elysia-bench/payload)をトランスパイル対象にする
  transpilePackages: ["@elysia-bench/payload"],
}

export default nextConfig
