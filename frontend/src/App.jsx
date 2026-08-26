import { useEffect, useMemo, useState, useCallback } from 'react'
import { BrowserProvider, Contract, Interface, parseEther, formatEther } from 'ethers'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './abi.js'
import { uploadFileToIPFS, uploadJSONToIPFS } from './lib/ipfs.js'

const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7' // 11155111
const BLOCKSCOUT_BASE = 'https://eth-sepolia.blockscout.com'
// Public relay works but is shared/rate-limited — set VITE_SEPOLIA_RPC_URL
// to a dedicated Alchemy/Infura endpoint for anything beyond a demo.
const SEPOLIA_RPC_URL = import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org'

const STEPS = [
  { key: 'uploading-image', label: 'Uploading artwork' },
  { key: 'uploading-metadata', label: 'Preparing metadata' },
  { key: 'awaiting-signature', label: 'Confirm in wallet' },
  { key: 'pending', label: 'Confirming' }
]

function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''
}

export default function App() {
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(null)
  const [chainOk, setChainOk] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')

  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [preview, setPreview] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const [stage, setStage] = useState('idle') // idle | uploading-image | uploading-metadata | awaiting-signature | pending | confirmed | error
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState('')
  const [tokenId, setTokenId] = useState(null)

  const provider = useMemo(() => (window.ethereum ? new BrowserProvider(window.ethereum) : null), [])
  const [supply, setSupply] = useState(null) // { minted, max }

  const loadSupply = useCallback(async () => {
    if (!provider) return
    try {
      const readContract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
      const [minted, max, price] = await Promise.all([
        readContract.totalMinted(),
        readContract.MAX_SUPPLY(),
        readContract.mintPrice()
      ])
      setSupply({ minted: minted.toString(), max: max.toString(), price: formatEther(price) })
    } catch {
      // Contract may not expose these views — fine to just skip the readout.
    }
  }, [provider])

  useEffect(() => {
    loadSupply()
  }, [loadSupply])

  useEffect(() => {
    if (!provider || !account) {
      setBalance(null)
      return
    }
    provider.getBalance(account).then((bal) => setBalance(formatEther(bal))).catch(() => setBalance(null))
  }, [provider, account, chainOk])

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
              rpcUrls: [SEPOLIA_RPC_URL],
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

  const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  const MAX_FILE_MB = 4

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return

    if (!ACCEPTED_TYPES.includes(f.type)) {
      setFileError('Use a PNG, JPG, GIF, or WEBP image.')
      e.target.value = ''
      return
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`Image must be under ${MAX_FILE_MB}MB.`)
      e.target.value = ''
      return
    }

    setFileError('')
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const canMint = account && chainOk && file && name.trim() && stage === 'idle'
  const isBusy = stage !== 'idle' && stage !== 'error' && stage !== 'confirmed'

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
      const tx = await contract.mint(account, metadataURI, { value: parseEther(supply?.price || '0.001') })

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
      loadSupply()
      provider.getBalance(account).then((bal) => setBalance(formatEther(bal))).catch(() => {})
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
    setFileError('')
    setPreview('')
    setName('')
    setDescription('')
  }

  const nftLink = tokenId
    ? `${BLOCKSCOUT_BASE}/token/${CONTRACT_ADDRESS}/instance/${tokenId}`
    : `${BLOCKSCOUT_BASE}/tx/${txHash}`

  const editionLabel = tokenId ? `#${tokenId.padStart(4, '0')}` : '#————'

  return (
    <>
      <div className="app">
        <div className="hero">
          <h1 className="hero__title">Mint your edition</h1>
          <p className="hero__subtitle">Upload artwork, set a name, and mint an ERC-721 on Sepolia — on-chain in a few clicks.</p>
        </div>

        <header className="topbar">
          <div className="brand">
            <span className="brand__mark">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <polygon points="12,3 21,12 12,21 3,12" fill="#fcd535" />
              </svg>
            </span>
            Mintora
            <span className="brand__net">ERC-721</span>
          </div>

          {account ? (
            <div className="wallet-pill wallet-pill--connected">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16.5" cy="14" r="1" /></svg>
              <span className={`wallet-dot ${chainOk ? 'wallet-dot--live' : ''}`} />
              {shortAddr(account)}
              {balance !== null && <span className="wallet-pill__balance">{Number(balance).toFixed(3)} ETH</span>}
            </div>
          ) : (
            <button className="wallet-pill" onClick={connectWallet} disabled={connecting}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16.5" cy="14" r="1" /></svg>
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </header>

        <div className="pipeline">
          <div className="scanframe-col">
            <div className="scanframe-col__label">Token Preview</div>
            <div className={`scanframe ${isBusy ? 'scanframe--active' : ''}`}>
              {preview ? (
                <img src={preview} alt="Artwork preview" className="scanframe__img" />
              ) : (
                <div className="scanframe__placeholder">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5-11 11" />
                  </svg>
                  <span>No image yet</span>
                </div>
              )}
              <span className="scanframe__tag">{editionLabel}</span>
            </div>
            <div className="scanframe-col__meta">
              <span>Status</span>
              <strong>{isBusy ? 'Minting' : stage === 'confirmed' ? 'Minted' : 'Draft'}</strong>
            </div>
            {supply && (
              <div className="scanframe-col__meta">
                <span>Supply</span>
                <strong>{supply.minted} / {supply.max}</strong>
              </div>
            )}
            {supply && (
              <div className="scanframe-col__meta">
                <span>Price</span>
                <strong>{supply.price} ETH</strong>
              </div>
            )}
          </div>

          <div className="console">
            {!account || !chainOk ? (
              <div>
                <h2 className="console__title">Connect your wallet</h2>
                <p className="console__notice">
                  {!window.ethereum
                    ? 'No wallet detected — install MetaMask to continue.'
                    : !account
                    ? 'Connect the wallet you want to mint to.'
                    : 'Wrong network — switch to continue.'}
                </p>
                {account && !chainOk ? (
                  <button className="btn-run" onClick={switchToSepolia}>
                    Switch Network
                  </button>
                ) : (
                  <button className={`btn-run ${connecting ? 'btn-run--loading' : ''}`} onClick={connectWallet} disabled={connecting}>
                    {connecting ? 'Connecting…' : 'Connect Wallet'}
                  </button>
                )}
                {connectError && <div className="error-box" style={{ marginTop: 14 }}>{connectError}</div>}
              </div>
            ) : stage === 'confirmed' ? (
              <div className="cert">
                <div className="cert__seal">✓</div>
                <h3>Mint successful</h3>
                <p>Edition {editionLabel} confirmed.</p>
                <a className="cert-link" href={nftLink} target="_blank" rel="noreferrer">
                  View on Blockscout →
                </a>
                <button className="btn-ghost" onClick={resetForm}>
                  Mint Another
                </button>
              </div>
            ) : isBusy ? (
              <div>
                <h2 className="console__title">Minting…</h2>
                <ul className="log">
                  {STEPS.map((s, i) => {
                    const currentIndex = STEPS.findIndex((x) => x.key === stage)
                    const done = i < currentIndex
                    const active = i === currentIndex
                    return (
                      <li
                        key={s.key}
                        className={`log__row ${active ? 'log__row--active' : ''} ${done ? 'log__row--done' : ''}`}
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
                <h2 className="console__title">Mint details</h2>

                {stage === 'error' && errorMsg && <div className="error-box">{errorMsg}</div>}

                <div className="field">
                  <label>
                    <svg className="field-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5-11 11" /></svg>
                    Artwork
                  </label>
                  <div className="dropzone">
                    {preview ? (
                      <div className="dropzone__filled">
                        <img src={preview} alt="" className="dropzone__thumb" />
                        <p className="dropzone__hint"><strong>{file?.name || 'Image selected'}</strong><br />Click to replace</p>
                      </div>
                    ) : (
                      <p className="dropzone__hint"><strong>Click to upload</strong> or drop an image</p>
                    )}
                    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleFile} />
                  </div>
                  {fileError ? (
                    <p className="field-error">{fileError}</p>
                  ) : (
                    <p className="field-hint">PNG, JPG, GIF, or WEBP · up to 4MB</p>
                  )}
                </div>

                <div className="field">
                  <label>
                    <svg className="field-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Obsidian Drift #001"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                  />
                </div>

                <div className="field">
                  <label>
                    <svg className="field-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 5h16M4 10h16M4 15h11M4 20h7" /></svg>
                    Description
                  </label>
                  <textarea
                    placeholder="What makes this piece worth minting?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={400}
                  />
                </div>

                <button className="btn-run" onClick={handleMint} disabled={!canMint}>
                  Mint NFT{supply ? ` · ${supply.price} ETH` : ''}
                </button>
              </div>
            )}
          </div>
        </div>

        <footer className="foot">
          {shortAddr(CONTRACT_ADDRESS)}
        </footer>
      </div>
    </>
  )
}