import { NextRequest } from "next/server"
import { buildRegistry } from "@/lib/build-logger"
import type { LogEntry } from "@/types/build"

export async function GET(request: NextRequest): Promise<Response> {
  const buildId = request.nextUrl.searchParams.get("buildId")

  if (!buildId) {
    return new Response("Missing buildId", { status: 400 })
  }

  const logger = buildRegistry.get(buildId)
  if (!logger) {
    return new Response("Build not found", { status: 404 })
  }

  const encoder = new TextEncoder()

  function formatSSE(entry: LogEntry): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(entry)}\n\n`)
  }

  const stream = new ReadableStream({
    start(controller) {
      // Replay already-accumulated entries
      for (const entry of logger.allEntries) {
        controller.enqueue(formatSSE(entry))
      }

      if (logger.isDone) {
        controller.close()
        return
      }

      // Subscribe for new entries
      const unsubscribe = logger.subscribe((entry) => {
        controller.enqueue(formatSSE(entry))
        if (entry.type === "done") {
          unsubscribe()
          controller.close()
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
