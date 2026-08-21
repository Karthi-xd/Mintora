import { useEffect, useMemo, useState, useCallback } from 'react'
import { BrowserProvider, Contract, Interface } from 'ethers'
import Lattice from './components/Lattice.jsx'
import SplitText from './components/SplitText.jsx'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './abi.js'
import { uploadFileToIPFS, uploadJSONToIPFS } from './lib/ipfs.js'

const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7' // 11155111
const BLOCKSCOUT_BASE = 'https://eth-sepolia.blockscout.com'

const STEPS = [
  { key: 'uploading-image', label: 'agent.pin(artwork → ipfs)' },
  { key: 'uploading-metadata', label: 'agent.pin(metadata → ipfs)' },
  { key: 'awaiting-signature', label: 'agent.request(wallet.sign)' },
  { key: 'pending', label: 'agent.await(sepolia.confirm)' }
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

  const editionLabel = tokenId ? `#${tokenId.padStart(4, '0')}` : '#————'

  return (
    <>
      <Lattice />
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
          <span className="hero__eyebrow">Agentic mint pipeline · Sepolia testnet</span>
          <h1 className="hero__title">
            <SplitText text="Direct the agent. It mints." as="span" className="glow-text" />
          </h1>
          <p className="hero__sub">
            Hand off an image and a name — the agent pins it to IPFS, builds the
            metadata, and signs it into a token on-chain. You approve each step.
          </p>
        </div>

        <div className="pipeline">
          <div className="scanframe-col">
            <div className="scanframe-col__label">// node_01 · artwork input</div>
            <div className={`scanframe ${isBusy ? 'scanframe--active' : ''}`}>
              <span className="scanframe__corner scanframe__corner--tl" />
              <span className="scanframe__corner scanframe__corner--tr" />
              <span className="scanframe__corner scanframe__corner--bl" />
              <span className="scanframe__corner scanframe__corner--br" />
              {preview ? (
                <img src={preview} alt="Artwork preview" className="scanframe__img" />
              ) : (
                <div className="scanframe__placeholder">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5-11 11" />
                  </svg>
                  <span>Awaiting input</span>
                </div>
              )}
              <span className="scanframe__tag">{editionLabel}</span>
            </div>
            <div className="scanframe-col__meta">
              <span>status</span>
              <strong>{isBusy ? 'processing' : stage === 'confirmed' ? 'sealed' : 'idle'}</strong>
            </div>
          </div>

          <div className="console">
            {!account || !chainOk ? (
              <div>
                <div className="console__bar">
                  <span>agent.session</span>
                  <strong>disconnected</strong>
                </div>
                <h2 className="console__title">Authorize the Agent</h2>
                <p className="console__notice">
                  {!window.ethereum
                    ? 'No wallet detected. Install MetaMask to continue.'
                    : !account
                    ? 'Connect your wallet so the agent can sign transactions on your behalf.'
                    : 'Wrong network — the agent only operates on Sepolia.'}
                </p>
                {account && !chainOk ? (
                  <button className="btn-run" onClick={switchToSepolia}>
                    Switch to Sepolia
                  </button>
                ) : (
                  <button className="btn-run" onClick={connectWallet} disabled={connecting}>
                    {connecting ? 'Connecting…' : 'Connect Wallet'}
                  </button>
                )}
                {connectError && <div className="error-box" style={{ marginTop: 14 }}>{connectError}</div>}
              </div>
            ) : stage === 'confirmed' ? (
              <div className="cert">
                <div className="console__bar">
                  <span>agent.session</span>
                  <strong>complete</strong>
                </div>
                <div className="cert__seal">✓</div>
                <h3>Pipeline Complete</h3>
                <p>Edition {editionLabel} sealed on Sepolia.</p>
                <a className="cert-link" href={nftLink} target="_blank" rel="noreferrer">
                  View on Blockscout ↗
                </a>
                <button className="btn-ghost" onClick={resetForm}>
                  Run Again
                </button>
              </div>
            ) : isBusy ? (
              <div>
                <div className="console__bar">
                  <span>agent.session</span>
                  <strong>running</strong>
                </div>
                <h2 className="console__title">Executing Pipeline</h2>
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
                <div className="console__bar">
                  <span>agent.session</span>
                  <strong>ready</strong>
                </div>
                <h2 className="console__title">Configure Mint</h2>

                {stage === 'error' && errorMsg && <div className="error-box">{errorMsg}</div>}

                <div className="field">
                  <label>artwork</label>
                  <div className="dropzone">
                    {preview ? (
                      <p className="dropzone__hint"><strong>Loaded</strong> — click to replace</p>
                    ) : (
                      <p className="dropzone__hint">
                        <strong>Click to upload</strong> or drag an image here
                      </p>
                    )}
                    <input type="file" accept="image/*" onChange={handleFile} />
                  </div>
                </div>

                <div className="field">
                  <label>name</label>
                  <input
                    type="text"
                    placeholder="e.g. Obsidian Drift #001"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                  />
                </div>

                <div className="field">
                  <label>description</label>
                  <textarea
                    placeholder="What makes this piece worth minting?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={400}
                  />
                </div>

                <button className="btn-run" onClick={handleMint} disabled={!canMint}>
                  Run Mint Pipeline
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