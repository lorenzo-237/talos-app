/**
 * Fetch wrapper with automatic token refresh on 401.
 *
 * Flow:
 *  1. Make the original request.
 *  2. If 401, attempt POST /api/auth/refresh.
 *  3. If refresh succeeds, retry the original request once.
 *  4. If the retry is still 401 (or the refresh itself failed), redirect to /login.
 *
 * Only runs in the browser — SSR callers should use plain fetch.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status !== 401) return res

  // Attempt token refresh
  const refreshRes = await fetch("/api/auth/refresh", { method: "POST" })
  if (!refreshRes.ok) {
    window.location.href = "/login"
    return res
  }

  // Retry the original request with the new cookies (set by the refresh response)
  const retryRes = await fetch(input, init)
  if (retryRes.status === 401) {
    window.location.href = "/login"
  }
  return retryRes
}
