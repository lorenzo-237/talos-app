import { NextRequest, NextResponse } from "next/server"
import { buildRegistry } from "@/lib/build-logger"
import { requireAuth } from "@/lib/api-auth"
import type { LogEntry } from "@/types/build"

/**
 * GET /api/build-stream?buildId=xxx
 *
 * Server-Sent Events endpoint. The client opens a persistent HTTP connection
 * here and receives log entries as they are emitted by the running build.
 *
 * Protocol: each message is a UTF-8 text frame in the SSE format:
 *   data: <JSON>\n\n
 *
 * On connect, ALL log entries accumulated so far are replayed immediately,
 * so a client that joins mid-build (or after a page reload) sees the full
 * history before receiving live updates.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth as Response

  const buildId = request.nextUrl.searchParams.get("buildId")
  if (!buildId) {
    return new Response("Missing buildId", { status: 400 })
  }

  const logger = buildRegistry.get(buildId)
  if (!logger) {
    return new Response("Build not found", { status: 404 })
  }

  // ── SSE serialisation ──────────────────────────────────────────────────────
  //
  // The SSE wire format is plain text: each event is a line starting with
  // "data: " followed by the payload, terminated by a blank line (\n\n).
  // We encode to Uint8Array because ReadableStream works with binary chunks.

  const encoder = new TextEncoder()

  function encodeLogEntryAsSSEFrame(logEntry: LogEntry): Uint8Array {
    const json = JSON.stringify(logEntry)
    const sseFrame = `data: ${json}\n\n`
    return encoder.encode(sseFrame)
  }

  // ── Cleanup handle ─────────────────────────────────────────────────────────
  //
  // Declared outside the ReadableStream so that cancel() — which is called
  // when the client disconnects — can reach it and remove the listener from
  // the logger. Without this, the listener would remain in logger.listeners
  // and the next controller.enqueue() call on the closed stream would throw,
  // propagating an exception into the running build task.

  let stopListening: (() => void) | undefined

  // ── ReadableStream ─────────────────────────────────────────────────────────
  //
  // Next.js App Router does not give access to the raw HTTP socket, so the
  // only way to keep a response open and push data over time is to hand a
  // ReadableStream to the Response constructor. Next.js then writes every
  // chunk produced by the stream to the HTTP connection as it arrives.
  //
  // The `controller` object is the write-side handle of the stream:
  //   controller.enqueue(chunk)  — pushes a chunk to the client
  //   controller.close()         — signals end-of-stream, closes the connection
  //
  // `start(controller)` is called once, immediately, when the stream is
  // created. `cancel()` is called if the consumer (the browser) closes
  // the connection before the stream ends.

  const sseStream = new ReadableStream({
    start(controller) {
      // ── 1. Replay history ────────────────────────────────────────────────
      // Send every log entry that was emitted before this client connected.
      // This lets a client that joins mid-build (or after a page reload)
      // receive the full log from the beginning before live updates start.
      const pastEntries = logger.allEntries
      for (const pastEntry of pastEntries) {
        controller.enqueue(encodeLogEntryAsSSEFrame(pastEntry))
      }

      // ── 2. Already finished? ─────────────────────────────────────────────
      // If the build completed before this client connected, the replay above
      // already sent the "done" entry. Close immediately — nothing more to do.
      if (logger.isDone) {
        controller.close()
        return
      }

      // ── 3. Subscribe to live entries ─────────────────────────────────────
      // logger.subscribe registers a callback that is invoked synchronously
      // each time the build emits a new log entry (logger.log / .error / …).
      // It returns an unsubscribe function that removes this callback.
      stopListening = logger.subscribe((newEntry: LogEntry) => {
        // Push the new entry to the client over the open HTTP connection.
        controller.enqueue(encodeLogEntryAsSSEFrame(newEntry))

        // "done" is the terminal event — the build has finished.
        // Remove the listener and close the stream so the browser knows
        // the SSE connection is complete.
        if (newEntry.type === "done") {
          stopListening?.()
          controller.close()
        }
      })
    },

    // Called when the browser closes the connection (page reload, navigation,
    // tab close, etc.). We must remove our listener from the logger here;
    // otherwise the next emission would try to enqueue into an already-closed
    // stream controller, which throws and would propagate into the build task.
    cancel() {
      stopListening?.()
    },
  })

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
