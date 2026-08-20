# Mintora

A minimal, dark, animated NFT minting site. Connect a wallet, upload artwork,
pin it to IPFS, and mint on Sepolia — all client-side.

## Stack

- React + Vite
- ethers.js v6, talking to `window.ethereum` (MetaMask)
- Pinata for IPFS pinning (image + metadata JSON)
- Two small React-Bits-style effects (`Aurora` background, `SplitText`
  heading) built from scratch in CSS to match the reactbits.dev aesthetic
  without pulling in the WebGL/OGL dependency chain

## 1. Install

```bash
npm install
```

## 2. Configure

```bash
cp .env.example .env
```

Fill in `.env`:

```
VITE_PINATA_JWT=<your Pinata JWT>
```

Get a JWT from **Pinata → API Keys → New Key** (scopes: `pinFileToIPFS`,
`pinJSONToIPFS`). Restart `npm run dev` after editing `.env` — Vite only
reads env files on startup.

> **Heads up:** any `VITE_*` variable is bundled into the client and visible
> to anyone who opens dev tools. That's fine for a hackathon/testnet build,
> but for production you'd want to proxy the Pinata calls through a small
> backend so the JWT never ships to the browser.

## 3. Paste your ABI

Open `src/abi.js` and replace the placeholder `CONTRACT_ABI` array with the
ABI you exported from Remix (Compilation Details → ABI → Copy). It's already
valid JSON, so it pastes straight in. The app only calls `mint(address,string)`,
but pasting the full ABI means `ownerOf`, `tokenURI`, etc. are available if
you extend the UI later. The `Transfer` event in the placeholder is used to
pull the minted `tokenId` out of the transaction receipt — keep it (or your
contract's equivalent) in the ABI if you want the "View on Blockscout" link
to point straight at the NFT instance instead of just the transaction.

`CONTRACT_ADDRESS` is already set to:

```
0x82493148e7bF01A334d1faE8299E8517f6305976
```

## 4. Run

```bash
npm run dev
```

## Flow

1. **Connect Wallet** — requests accounts via MetaMask, and if you're not on
   Sepolia (`chainId 11155111`), prompts a network switch (adding it first
   if your wallet doesn't have it yet).
2. **Upload** an image, give it a **name** and **description**.
3. **Mint** — the app:
   - uploads the image to IPFS via Pinata (`pinFileToIPFS`)
   - builds an ERC-721-style metadata JSON (`{ name, description, image }`)
     and pins that too (`pinJSONToIPFS`)
   - calls `mint(yourAddress, metadataURI)` on the contract
   - shows pending → confirming → confirmed states as the transaction lands
   - links out to the NFT (or transaction, as a fallback) on Sepolia
     Blockscout

## Files

```
src/
  App.jsx              orchestrates wallet, form, mint flow, tx status
  abi.js               CONTRACT_ADDRESS + CONTRACT_ABI (paste yours here)
  lib/ipfs.js           Pinata upload helpers
  components/
    Aurora.jsx/.css     ambient animated background
    SplitText.jsx/.css  per-character heading reveal
```
