// Shared guards for the Pinata proxy routes. These stop the routes being
// used as a free, unauthenticated file-pinning service by anyone who finds
// the endpoint URL.

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 10

// In-memory — only persists for the lifetime of a warm serverless instance,
// so it won't stop a distributed attacker, but it stops casual abuse/bots
// hammering a single instance. Swap for Vercel KV/Upstash Redis if you need
// a durable, cross-instance limit.
const hits = new Map()

/**
 * Rejects requests whose Origin/Referer isn't in ALLOWED_ORIGIN.
 * If ALLOWED_ORIGIN isn't set (e.g. local dev), the check is skipped.
 */
export function checkOrigin(req) {
  const allowed = (process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (allowed.length === 0) return true

  const origin = req.headers.origin || req.headers.referer || ''
  return allowed.some((a) => origin.startsWith(a))
}

/** Returns false once an IP exceeds MAX_REQUESTS_PER_WINDOW within WINDOW_MS. */
export function rateLimit(req) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'

  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)

  return recent.length <= MAX_REQUESTS_PER_WINDOW
}