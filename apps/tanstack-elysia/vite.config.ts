import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  // Next.js(:3000) / Elysia 単体(:3001,:3002) と同時に立てられるよう :3003 を使う
  server: { port: 3003 },
  plugins: [tanstackStart(), viteReact()],
})
