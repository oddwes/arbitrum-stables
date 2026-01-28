import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { arbitrum } from 'wagmi/chains'
import { ARBITRUM_STABLES } from '../data/arbitrumStables'
import { fetchUsdPrice } from '../lib/coingecko'

const LOGO_BY_SYMBOL = {
  USDC: '/usdc-logo.svg',
  USDT: '/usdt-logo.svg',
  DAI: '/dai-logo.svg',
  FRAX: '/frax-logo.svg',
}

function clampInput(s) {
  return s.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
}

function toNum(s) {
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function fmt(n, max = 6) {
  return n.toLocaleString(undefined, { maximumFractionDigits: max })
}

function shortAddr(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : ''
}

function shouldAutoConnectUnicornFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get('walletId') === 'inApp' && !!params.get('authCookie')
}

export function BuyCard() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()

  const coins = ARBITRUM_STABLES
  const [coin, setCoin] = useState(coins[0])
  const [mode, setMode] = useState('arb') // 'usd' | 'arb'
  const [coinMenuOpen, setCoinMenuOpen] = useState(false)
  const [usdInput, setUsdInput] = useState('')
  const [arbInput, setArbInput] = useState('0.01')
  const [stableUsd, setStableUsd] = useState(null)
  const [arbUsd, setArbUsd] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const pickerRef = useRef(null)

  useEffect(() => {
    if (!coinMenuOpen) return
    const onDoc = (e) => {
      if (pickerRef.current && pickerRef.current.contains(e.target)) return
      setCoinMenuOpen(false)
    }
    document.addEventListener('click', onDoc, { capture: true })
    return () => document.removeEventListener('click', onDoc, { capture: true })
  }, [coinMenuOpen])

  useEffect(() => {
    const abort = new AbortController()
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [s, a] = await Promise.all([
          fetchUsdPrice(coin.id, abort.signal),
          fetchUsdPrice('arbitrum', abort.signal),
        ])
        setStableUsd(s)
        setArbUsd(a)
      } catch (e) {
        if (e?.name !== 'AbortError') setError(e?.message || 'Failed to load price')
        setStableUsd(null)
        setArbUsd(null)
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => abort.abort()
  }, [coin])

  useEffect(() => {
    if (!arbUsd) return
    if (mode === 'usd') {
      const u = toNum(usdInput)
      setArbInput(u == null ? '' : String(u / arbUsd))
    } else {
      const a = toNum(arbInput)
      setUsdInput(a == null ? '' : String(a * arbUsd))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, arbUsd])

  const spendUsd = useMemo(() => {
    if (mode === 'usd') return toNum(usdInput)
    if (!arbUsd) return null
    const a = toNum(arbInput)
    return a == null ? null : a * arbUsd
  }, [mode, usdInput, arbInput, arbUsd])

  const stableOut = useMemo(() => {
    if (spendUsd == null || !stableUsd) return null
    return spendUsd / stableUsd
  }, [spendUsd, stableUsd])

  const canBuy = useMemo(() => {
    const a = mode === 'arb' ? toNum(arbInput) : (arbUsd ? (toNum(usdInput) ?? 0) / arbUsd : null)
    return typeof a === 'number' && a > 0 && Number.isFinite(a)
  }, [mode, arbInput, usdInput, arbUsd])

  const logoSrc = LOGO_BY_SYMBOL[coin.symbol] ?? ''

  const onInput = (e) => {
    const v = clampInput(e.target.value)
    if (mode === 'usd') setUsdInput(v)
    else setArbInput(v)
    if (!arbUsd) return
    if (mode === 'usd') setArbInput(v ? String(Number(v) / arbUsd) : '')
    else setUsdInput(v ? String(Number(v) * arbUsd) : '')
  }

  const pickUsd = (v) => {
    setMode('usd')
    setUsdInput(v)
    if (arbUsd) setArbInput(String(Number(v) / arbUsd))
  }

  const pickArb = (v) => {
    setMode('arb')
    setArbInput(v)
    if (arbUsd) setUsdInput(String(Number(v) * arbUsd))
  }

  const onConnect = () => {
    const injected = connectors.find((c) => c.id === 'injected') ?? connectors[0]
    const unicorn = connectors.find((c) => c.id === 'unicorn')
    const connector = shouldAutoConnectUnicornFromUrl() && unicorn ? unicorn : injected
    if (!connector) return
    connect({ connector, chainId: arbitrum.id })
  }

  return (
    <div className="card">
      <div className="cardHead">
        <div>
          <div className="title">Get {coin.symbol}</div>
          <div className="subtle">Buy on Arbitrum</div>
        </div>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
          <div className="addrChip" title={isConnected ? address : 'Not connected'}>
            {isConnected ? shortAddr(address) : 'Not connected'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {isConnected ? (
              <button className="chip" type="button" onClick={() => disconnect()}>
                Disconnect
              </button>
            ) : (
              <button className="chip" type="button" disabled={isConnecting} onClick={onConnect}>
                {isConnecting ? 'Connecting…' : 'Connect'}
              </button>
            )}
          </div>
          {!isConnected && connectError ? <div className="err">{connectError.message}</div> : null}
        </div>
      </div>

      <div className="panel">
        <div className="coinRow">
          <div className="coinIcon">
            {logoSrc ? <img className="coinLogo" src={logoSrc} alt={`${coin.symbol} logo`} /> : coin.symbol.slice(0, 1)}
          </div>
          <div className="coinMeta">
            <div className="coinSym">{coin.symbol}</div>
            <div className="subtle">Arbitrum</div>
          </div>
          <div className="coinPicker" ref={pickerRef}>
            <button
              className="coinSelectBtn"
              type="button"
              aria-haspopup="menu"
              aria-expanded={coinMenuOpen}
              onClick={() => setCoinMenuOpen((v) => !v)}
            >
              {coin.symbol}
              <span className="chev">▾</span>
            </button>
            <div className={`coinMenu ${coinMenuOpen ? 'open' : ''}`} role="menu" aria-label="Select stablecoin">
              {coins.map((c) => (
                <button
                  key={c.id}
                  className="coinItem"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCoin(c)
                    setCoinMenuOpen(false)
                  }}
                >
                  {c.symbol}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="amountBox">
          <div className="amountTop">
            <input
              className="amountInput"
              inputMode="decimal"
              placeholder="0.00"
              value={mode === 'usd' ? usdInput : arbInput}
              aria-label="Buy amount"
              onChange={onInput}
            />
            <button className="modePill" type="button" aria-label="Toggle input mode" onClick={() => setMode(mode === 'usd' ? 'arb' : 'usd')}>
              <span className={mode === 'usd' ? 'on' : ''}>USD</span>
              <span className={mode === 'arb' ? 'on' : ''}>Arbitrum</span>
            </button>
          </div>

          <div className="amountSub">
            {loading ? <span className="subtle">Fetching price…</span> : null}
            {!loading && error ? <span className="err">{error}</span> : null}
            {!loading && !error ? (
              <span className="subtle">
                {mode === 'usd'
                  ? `≈ ${stableOut == null ? '—' : fmt(stableOut, 6)} ${coin.symbol}`
                  : `≈ $${spendUsd == null ? '—' : fmt(spendUsd, 8)}`}
              </span>
            ) : null}
          </div>
        </div>

        <div className="chips">
          {mode === 'usd' ? (
            <>
              {['5', '10', '20'].map((v) => (
                <button key={v} className="chip" type="button" onClick={() => pickUsd(v)}>
                  ${v}
                </button>
              ))}
            </>
          ) : (
            <>
              {['0.01', '0.1', '1'].map((v) => (
                <button key={v} className="chip" type="button" onClick={() => pickArb(v)}>
                  {v}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="row">
          <div className="subtle">Current Balance</div>
          <div className="right">ARB</div>
        </div>

        <button className="buyBtn" type="button" disabled={!canBuy}>
          Buy
        </button>

        <div className="priceLine subtle">
          {stableUsd && arbUsd ? `1 ARB ≈ $${fmt(arbUsd, 8)} · 1 ${coin.symbol} ≈ $${fmt(stableUsd, 8)}` : ''}
        </div>
      </div>
    </div>
  )
}
