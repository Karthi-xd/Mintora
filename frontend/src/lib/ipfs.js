const GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1]) // strip the data: prefix
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

/** Uploads a raw file (the artwork) to IPFS via your own /api/pinata-file route. */
export async function uploadFileToIPFS(file) {
  const fileBase64 = await fileToBase64(file)

  const res = await fetch('/api/pinata-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64, fileName: file.name, mimeType: file.type })
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Image upload failed (${res.status})`)
  return data.ipfsUri
}

/** Uploads a metadata JSON object to IPFS via your own /api/pinata-json route. */
export async function uploadJSONToIPFS(metadata) {
  const res = await fetch('/api/pinata-json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata })
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Metadata upload failed (${res.status})`)
  return data.ipfsUri
}

/** Converts an ipfs:// URI into an https gateway URL for preview purposes. */
export function toGatewayURL(ipfsUri) {
  if (!ipfsUri) return ''
  return ipfsUri.startsWith('ipfs://') ? `${GATEWAY}/ipfs/${ipfsUri.slice(7)}` : ipfsUri
}