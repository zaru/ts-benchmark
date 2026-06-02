import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: Home,
})

function Home() {
  return (
    <main>
      <h1>elysia-bench (TanStack Start)</h1>
      <p>
        Benchmark endpoint: <code>GET /api</code>
      </p>
    </main>
  )
}
