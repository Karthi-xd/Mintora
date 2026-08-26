// Vercel serverless function: /api/pinata-file
// Receives a base64-encoded image from the browser, uploads it to Pinata
// using PINATA_JWT (a server-only env var, no VITE_ prefix — never bundled
// into client JS), and returns the resulting ipfs:// URI.

import { checkOrigin, rateLimit } from './_utils.js'

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
    const { fileBase64, fileName, mimeType } = req.body
    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'Missing fileBase64 or fileName' })
    }

    const buffer = Buffer.from(fileBase64, 'base64')
    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image must be under 4MB' })
    }

    const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' })

    const form = new FormData()
    form.append('file', blob, fileName)
    form.append('pinataMetadata', JSON.stringify({ name: fileName }))

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form
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