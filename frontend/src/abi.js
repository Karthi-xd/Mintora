// Paste the ABI you exported from Remix (Compilation Details → ABI → Copy)
// below, replacing the placeholder array. Only `mint(address,string)` is
// required for this app to function, but pasting the full ABI is safest —
// it costs nothing and means you don't have to remember to add events
// later if you want to read tokenURI, ownerOf, etc.
//
// Remix export is already valid JSON, so you can paste it verbatim inside
// the brackets below.

export const CONTRACT_ABI = [
  // --- placeholder, replace with your real ABI ---
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'string', name: 'uri', type: 'string' }
    ],
    name: 'mint',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'from', type: 'address' },
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' }
    ],
    name: 'Transfer',
    type: 'event'
  }
  // --- end placeholder ---
]

export const CONTRACT_ADDRESS = '0x82493148e7bF01A334d1faE8299E8517f6305976'
