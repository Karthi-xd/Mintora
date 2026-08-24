// Vercel serverless function: /api/pinata-json
// Receives a metadata object from the browser, uploads it to Pinata using
// PINATA_JWT (server-only), and returns the resulting ipfs:// URI.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
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