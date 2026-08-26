// Vercel serverless function: /api/pinata-json
// Receives a metadata object from the browser, uploads it to Pinata using
// PINATA_JWT (server-only), and returns the resulting ipfs:// URI.

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 10
const hits = new Map()

function checkOrigin(req) {
  const allowed = (process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (allowed.length === 0) return true
  const origin = req.headers.origin || req.headers.referer || ''
  return allowed.some((a) => origin.startsWith(a))
}

function rateLimit(req) {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!checkOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden origin' })
  }
  if (!rateLimit(req)) {
    return res.status(429).json({ error: 'Too many requests, slow down' })
  }

  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    return res.status(500).json({ error: 'Server missing PINATA_JWT env var' })
  }

  try {
    const { metadata } = req.body
    if (!metadata) {
      return res.status(400).json({ error: 'Missing metadata' })
    }

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pinataMetadata: { name: `${metadata.name || 'metadata'}.json` },
        pinataContent: metadata
      })
    })

    if (!pinataRes.ok) {
      const detail = await pinataRes.text().catch(() => '')
      return res.status(pinataRes.status).json({ error: `Pinata upload failed: ${detail}` })
    }

    const { IpfsHash } = await pinataRes.json()
    return res.status(200).json({ ipfsUri: `ipfs://${IpfsHash}` })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Upload failed' })
  }
}