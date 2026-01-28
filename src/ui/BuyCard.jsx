import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { arbitrum } from 'wagmi/chains'
import { ARBITRUM_STABLES } from '../data/arbitrumStables'
import { useCoinPrice } from '../lib/useCoinPrice'
import { useWalletBalance } from '../web3/hooks/useWalletBalance'

const LOGO_BY_SYMBOL = {
  USDC: '/usdc-logo.svg',
  USDT: '/usdt-logo.svg',
  DAI: '/dai-logo.svg',
  FRAX: '/frax-logo.svg',
}

function clampInput(s) {
  const cleaned = s.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
  const match = cleaned.match(/^\d*\.?\d{0,2}/)
  return match ? match[0] : ''
}

function toNum(s) {
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function truncDisplay(s) {
  const parts = s.split('.')
  if (parts.length === 1) return s
  return parts[0] + '.' + parts[1].slice(0, 2)
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

  const ARB_TOKEN = useMemo(
    () => '0x912CE59144191C1204E64559FE8253a0e49E6548',
    [],
  )
  const { data: arbBalance, isLoading: balancesLoading } = useWalletBalance({ address, tokenAddress: ARB_TOKEN })

  const coins = ARBITRUM_STABLES
  const [coin, setCoin] = useState(coins[0])
  const [mode, setMode] = useState('arb') // 'usd' | 'arb'
  const [coinMenuOpen, setCoinMenuOpen] = useState(false)
  const [usdInput, setUsdInput] = useState('')
  const [arbInput, setArbInput] = useState('0.01')
  const pickerRef = useRef(null)

  const { data: stableUsd, isLoading: stableLoading, error: stableError } = useCoinPrice(coin.id)
  const { data: arbUsd, isLoading: arbLoading, error: arbError } = useCoinPrice('arbitrum')
  const loading = stableLoading || arbLoading
  const error = stableError?.message || arbError?.message || ''

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
              value={mode === 'usd' ? truncDisplay(usdInput) : truncDisplay(arbInput)}
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
                ≈ {stableOut == null ? '—' : fmt(stableOut, 6)} {coin.symbol}
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
          <div className="right">
            {!isConnected ? '—' : balancesLoading ? '…' : `${arbBalance?.displayValue ?? '—'} ${arbBalance?.symbol ?? 'ARB'}`
            }
          </div>
        </div>

        <button className="buyBtn" type="button" disabled={!isConnected || !canBuy}>
          Buy
        </button>

        <div className="priceLine subtle">
          {stableUsd && arbUsd ? `1 ARB ≈ $${fmt(arbUsd, 8)} · 1 ${coin.symbol} ≈ $${fmt(stableUsd, 8)}` : ''}
        </div>
      </div>
    </div>
  )
}
