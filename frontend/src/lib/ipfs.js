const PINATA_JWT = import.meta.env.VITE_PINATA_JWT
const GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud'

function assertKey() {
  if (!PINATA_JWT) {
    throw new Error(
      'Missing VITE_PINATA_JWT. Add it to a .env file at the project root (see .env.example) and restart the dev server.'
    )
  }
}

/** Uploads a raw file (the artwork) to IPFS via Pinata. Returns an ipfs:// URI. */
export async function uploadFileToIPFS(file) {
  assertKey()
  const form = new FormData()
  form.append('file', file)
  form.append('pinataMetadata', JSON.stringify({ name: file.name }))

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Pinata image upload failed (${res.status}): ${detail || res.statusText}`)
  }

  const { IpfsHash } = await res.json()
  return `ipfs://${IpfsHash}`
}

/** Uploads a metadata JSON object to IPFS via Pinata. Returns an ipfs:// URI. */
export async function uploadJSONToIPFS(metadata) {
  assertKey()
  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pinataMetadata: { name: `${metadata.name || 'metadata'}.json` },
      pinataContent: metadata
    })
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Pinata metadata upload failed (${res.status}): ${detail || res.statusText}`)
  }

  const { IpfsHash } = await res.json()
  return `ipfs://${IpfsHash}`
}

/** Converts an ipfs:// URI into an https gateway URL for preview purposes. */
export function toGatewayURL(ipfsUri) {
  if (!ipfsUri) return ''
  return ipfsUri.startsWith('ipfs://') ? `${GATEWAY}/ipfs/${ipfsUri.slice(7)}` : ipfsUri
}
