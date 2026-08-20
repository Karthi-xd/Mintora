import { useEffect, useMemo, useState, useCallback } from 'react'
import { BrowserProvider, Contract, Interface } from 'ethers'
import Aurora from './components/Aurora.jsx'
import SplitText from './components/SplitText.jsx'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './abi.js'
import { uploadFileToIPFS, uploadJSONToIPFS } from './lib/ipfs.js'

const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7' // 11155111
const BLOCKSCOUT_BASE = 'https://eth-sepolia.blockscout.com'

const STEPS = [
  { key: 'uploading-image', label: 'Pinning artwork to IPFS' },
  { key: 'uploading-metadata', label: 'Pinning metadata to IPFS' },
  { key: 'awaiting-signature', label: 'Awaiting wallet signature' },
  { key: 'pending', label: 'Striking on Sepolia' }
]

function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''
}

export default function App() {
  const [account, setAccount] = useState(null)
  const [chainOk, setChainOk] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')

  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const [stage, setStage] = useState('idle') // idle | uploading-image | uploading-metadata | awaiting-signature | pending | confirmed | error
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState('')
  const [tokenId, setTokenId] = useState(null)

  const provider = useMemo(() => (window.ethereum ? new BrowserProvider(window.ethereum) : null), [])

  const switchToSepolia = useCallback(async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }]
      })
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID_HEX,
              chainName: 'Sepolia',
              nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://rpc.sepolia.org'],
              blockExplorerUrls: [BLOCKSCOUT_BASE]
            }
          ]
        })
      } else {
        throw err
      }
    }
  }, [])

  const syncNetwork = useCallback(async () => {
    if (!provider) return
    const network = await provider.getNetwork()
    setChainOk(network.chainId === 11155111n)
  }, [provider])

  const connectWallet = useCallback(async () => {
    setConnectError('')
    if (!window.ethereum) {
      setConnectError('No wallet found. Install MetaMask to continue.')
      return
    }
    setConnecting(true)
    try {
      const accounts = await provider.send('eth_requestAccounts', [])
      setAccount(accounts[0])
      await syncNetwork()
      const network = await provider.getNetwork()
      if (network.chainId !== 11155111n) {
        await switchToSepolia()
        await syncNetwork()
      }
    } catch (err) {
      setConnectError(err?.message || 'Could not connect wallet.')
    } finally {
      setConnecting(false)
    }
  }, [provider, switchToSepolia, syncNetwork])

  useEffect(() => {
    if (!window.ethereum) return
    const handleAccounts = (accs) => setAccount(accs[0] || null)
    const handleChain = () => syncNetwork()
    window.ethereum.on?.('accountsChanged', handleAccounts)
    window.ethereum.on?.('chainChanged', handleChain)
    return () => {
      window.ethereum.removeListener?.('accountsChanged', handleAccounts)
      window.ethereum.removeListener?.('chainChanged', handleChain)
    }
  }, [syncNetwork])

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const canMint = account && chainOk && file && name.trim() && stage === 'idle'

  async function handleMint() {
    setErrorMsg('')
    setTxHash('')
    setTokenId(null)
    try {
      setStage('uploading-image')
      const imageURI = await uploadFileToIPFS(file)

      setStage('uploading-metadata')
      const metadata = {
        name: name.trim(),
        description: description.trim(),
        image: imageURI
      }
      const metadataURI = await uploadJSONToIPFS(metadata)

      setStage('awaiting-signature')
      const signer = await provider.getSigner()
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      const tx = await contract.mint(account, metadataURI)

      setStage('pending')
      setTxHash(tx.hash)
      const receipt = await tx.wait()

      // Best-effort: pull the minted tokenId out of a Transfer event, if present.
      try {
        const iface = new Interface(CONTRACT_ABI)
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) continue
          const parsed = iface.parseLog(log)
          if (parsed?.name === 'Transfer') {
            setTokenId(parsed.args.tokenId?.toString() ?? null)
            break
          }
        }
      } catch {
        // ABI may not include Transfer — safe to ignore, we fall back to the tx link.
      }

      setStage('confirmed')
    } catch (err) {
      setErrorMsg(err?.shortMessage || err?.reason || err?.message || 'Something went wrong while minting.')
      setStage('error')
    }
  }

  function resetForm() {
    setStage('idle')
    setErrorMsg('')
    setTxHash('')
    setTokenId(null)
    setFile(null)
    setPreview('')
    setName('')
    setDescription('')
  }

  const nftLink = tokenId
    ? `${BLOCKSCOUT_BASE}/token/${CONTRACT_ADDRESS}/instance/${tokenId}`
    : `${BLOCKSCOUT_BASE}/tx/${txHash}`

  const editionLabel = tokenId ? `No. ${tokenId.padStart(4, '0')}` : 'No. ————'

  return (
    <>
      <Aurora />
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand__mark">◆</span>
            Mintora
            <span className="brand__net">Sepolia</span>
          </div>

          {account ? (
            <div className="wallet-pill wallet-pill--connected">
              <span className={`wallet-dot ${chainOk ? 'wallet-dot--live' : ''}`} />
              {shortAddr(account)}
            </div>
          ) : (
            <button className="wallet-pill" onClick={connectWallet} disabled={connecting}>
              <span className="wallet-dot" />
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </header>

        <div className="hero">
          <span className="hero__eyebrow">On-chain · Sepolia testnet</span>
          <h1 className="hero__title">
            <SplitText text="Strike your mark" as="span" />
          </h1>
          <p className="hero__sub">
            Upload artwork, pin it to IPFS, and press it into a token on Sepolia —
            straight from your browser wallet.
          </p>
        </div>

        <div className="ticket-wrap">
          <div className="ticket-perf" />
          <div className="ticket">
            <div className="seal">◆</div>

            {!account || !chainOk ? (
              <div className="connect-block">
                <p style={{ marginTop: 8 }}>
                  {!window.ethereum
                    ? 'No wallet detected. Install MetaMask to continue.'
                    : !account
                    ? 'Connect your wallet to begin the mint.'
                    : 'Wrong network — switch to Sepolia to continue.'}
                </p>
                {account && !chainOk ? (
                  <button className="btn-press" onClick={switchToSepolia}>
                    Switch to Sepolia
                  </button>
                ) : (
                  <button className="btn-press" onClick={connectWallet} disabled={connecting}>
                    {connecting ? 'Connecting…' : 'Connect Wallet'}
                  </button>
                )}
                {connectError && <div className="error-box">{connectError}</div>}
              </div>
            ) : stage === 'confirmed' ? (
              <div className="cert">
                <div className="ticket__meta" style={{ justifyContent: 'center', marginTop: 6 }}>
                  <span>Certificate of Mint</span>
                </div>
                <div className="cert__seal">✓</div>
                <h3>Struck &amp; Confirmed</h3>
                <p>Edition {editionLabel} is live on Sepolia.</p>
                <a className="cert-link" href={nftLink} target="_blank" rel="noreferrer">
                  View on Blockscout ↗
                </a>
                <button className="btn-ghost" onClick={resetForm}>
                  Mint Another
                </button>
              </div>
            ) : stage !== 'idle' && stage !== 'error' ? (
              <div>
                <div className="ticket__meta">
                  <span>Minting</span>
                  <strong>{editionLabel}</strong>
                </div>
                <h2 className="ticket__title">In Progress</h2>
                <ul className="status-list">
                  {STEPS.map((s, i) => {
                    const currentIndex = STEPS.findIndex((x) => x.key === stage)
                    const done = i < currentIndex
                    const active = i === currentIndex
                    return (
                      <li
                        key={s.key}
                        className={`status-row ${active ? 'status-row--active' : ''} ${done ? 'status-row--done' : ''}`}
                      >
                        {s.label}
                      </li>
                    )
                  })}
                </ul>
                {txHash && (
                  <p className="hash-tag">
                    tx {txHash} —{' '}
                    <a href={`${BLOCKSCOUT_BASE}/tx/${txHash}`} target="_blank" rel="noreferrer">
                      view
                    </a>
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="ticket__meta">
                  <span>Edition</span>
                  <strong>{editionLabel}</strong>
                </div>
                <h2 className="ticket__title">Prepare Strike</h2>

                {stage === 'error' && errorMsg && <div className="error-box">{errorMsg}</div>}

                <div className="field">
                  <label>Artwork</label>
                  <div className="dropzone">
                    {preview ? (
                      <img src={preview} alt="Selected artwork preview" className="dropzone__preview" />
                    ) : (
                      <p className="dropzone__hint">
                        <strong>Click to upload</strong> or drag an image here
                      </p>
                    )}
                    <input type="file" accept="image/*" onChange={handleFile} />
                  </div>
                </div>

                <div className="field">
                  <label>Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Obsidian Drift #001"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                  />
                </div>

                <div className="field">
                  <label>Description</label>
                  <textarea
                    placeholder="What makes this piece worth minting?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={400}
                  />
                </div>

                <button className="btn-press" onClick={handleMint} disabled={!canMint}>
                  Strike the Mint
                </button>
              </div>
            )}
          </div>
        </div>

        <footer className="foot">
          Contract {shortAddr(CONTRACT_ADDRESS)} on Sepolia · Images pinned via Pinata
        </footer>
      </div>
    </>
  )
}