/**
 * Cooperative cancellation registry for background builds.
 *
 * Anchored on globalThis so Turbopack hot-reloads don't create a fresh
 * instance, matching the pattern used by buildRegistry and activeBuilds.
 */

declare global {
  var __cancelledBuilds: Set<string> | undefined
}

const cancelledBuilds: Set<string> =
  globalThis.__cancelledBuilds ?? new Set()
globalThis.__cancelledBuilds = cancelledBuilds

/** Mark a build as cancelled. The build loop will stop at its next checkpoint. */
export function requestCancellation(buildId: string): void {
  cancelledBuilds.add(buildId)
}

/** Returns true if a cancellation has been requested for this build. */
export function isCancelled(buildId: string): boolean {
  return cancelledBuilds.has(buildId)
}

/** Remove the cancellation flag once the build has cleaned up. */
export function clearCancellation(buildId: string): void {
  cancelledBuilds.delete(buildId)
}
