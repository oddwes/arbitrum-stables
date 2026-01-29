import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useWalletClient } from 'wagmi'
import { arbitrum } from 'wagmi/chains'
import { ARBITRUM_STABLES } from '../data/arbitrumStables'
import { useCoinPrice } from '../lib/useCoinPrice'
import { useWalletBalance } from '../web3/hooks/useWalletBalance'
import { Bridge, prepareTransaction, sendAndConfirmTransaction } from 'thirdweb'
import { defineChain } from 'thirdweb/chains'
import { viemAdapter } from 'thirdweb/adapters/viem'
import { parseUnits } from 'viem'
import { thirdwebClient } from '../web3/thirdwebClient'

const LOGO_BY_SYMBOL = {
  USDC: '/usdc-logo.svg',
  USDT: '/usdt-logo.svg',
  DAI: '/dai-logo.svg',
  FRAX: '/frax-logo.svg',
}

async function executeSwap(quote, client, account, onTxConfirmed) {
  for (const step of quote.steps || []) {
    for (const transaction of step.transactions || []) {
      const prepared = prepareTransaction({
        client,
        chain: defineChain(transaction.chainId),
        to: transaction.to,
        data: transaction.data || '0x',
        value: transaction.value ? BigInt(transaction.value) : undefined,
        gas: transaction.gas ? BigInt(transaction.gas) : undefined,
        maxFeePerGas: transaction.maxFeePerGas ? BigInt(transaction.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas ? BigInt(transaction.maxPriorityFeePerGas) : undefined,
      })

      const result = await sendAndConfirmTransaction({
        transaction: prepared,
        account,
      })
      onTxConfirmed?.()

      if (['buy', 'sell', 'transfer'].includes(transaction.action)) {
        let attempts = 0
        const maxAttempts = 200
        let completed = false

        while (attempts < maxAttempts) {
          try {
            const status = await Bridge.status({
              transactionHash: result.transactionHash,
              chainId: transaction.chainId,
              client,
            })

            if (status.status === 'COMPLETED') {
              completed = true
              break
            }

            if (status.status === 'FAILED') {
              throw new Error('Cross-chain transaction failed')
            }

            await new Promise((resolve) => setTimeout(resolve, 3000))
            attempts++
          } catch (error) {
            attempts++
            if (attempts >= maxAttempts) {
              throw error
            }
            await new Promise((resolve) => setTimeout(resolve, 3000))
          }
        }

        if (!completed && attempts >= maxAttempts) {
          throw new Error('Transaction timeout - please check status manually')
        }
      }
    }
  }
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
  const { data: walletClient } = useWalletClient()

  const ARB_TOKEN = useMemo(
    () => '0x912CE59144191C1204E64559FE8253a0e49E6548',
    [],
  )
  const { data: arbBalance, isLoading: balancesLoading } = useWalletBalance({ address, tokenAddress: ARB_TOKEN })

  const coins = ARBITRUM_STABLES
  const [coin, setCoin] = useState(coins[0])
  const [mode, setMode] = useState('usd') // 'usd' | 'arb'
  const [coinMenuOpen, setCoinMenuOpen] = useState(false)
  const [usdInput, setUsdInput] = useState('5')
  const [arbInput, setArbInput] = useState('')
  const [isBuying, setIsBuying] = useState(false)
  const [buyError, setBuyError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [buyComplete, setBuyComplete] = useState(false)
  const [buyDurationMs, setBuyDurationMs] = useState(8000)
  const [showProgress, setShowProgress] = useState(false)
  const [progressKey, setProgressKey] = useState(0)
  const pickerRef = useRef(null)
  const account = useMemo(() => {
    if (!walletClient) return null
    try {
      return viemAdapter.walletClient.fromViem({ walletClient })
    } catch {
      return null
    }
  }, [walletClient])

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

  const arbSpend = useMemo(() => {
    return mode === 'arb' ? toNum(arbInput) : (arbUsd ? (toNum(usdInput) ?? 0) / arbUsd : null)
  }, [mode, arbInput, usdInput, arbUsd])

  const arbBalanceNum = useMemo(() => {
    const v = arbBalance?.displayValue
    return v ? toNum(String(v)) : null
  }, [arbBalance])

  const insufficientBalance = useMemo(() => {
    return arbSpend != null && arbBalanceNum != null && arbSpend > arbBalanceNum
  }, [arbSpend, arbBalanceNum])

  const canBuy = useMemo(() => {
    return typeof arbSpend === 'number' && arbSpend > 0 && Number.isFinite(arbSpend) && !insufficientBalance && !!account && !!thirdwebClient
  }, [arbSpend, insufficientBalance, account])

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

  const startBuy = () => {
    setBuyError('')
    setShowConfirm(true)
  }

  const confirmBuy = async () => {
    if (!thirdwebClient) {
      setBuyError('Missing thirdweb client')
      return
    }
    if (!account) {
      setBuyError('Wallet not connected')
      return
    }

    const amount = arbInput.trim()
    if (!amount) return

    setBuyError('')
    setIsBuying(true)
    setShowProgress(false)
    setProgressKey((k) => k + 1)

    try {
      const quote = await Bridge.Sell.prepare({
        originChainId: arbitrum.id,
        originTokenAddress: ARB_TOKEN,
        destinationChainId: arbitrum.id,
        destinationTokenAddress: coin.address,
        amount: parseUnits(amount, 18),
        sender: account.address,
        receiver: account.address,
        client: thirdwebClient,
      })

      setBuyDurationMs((quote?.estimatedExecutionTimeMs || 8000) * 2)
      await executeSwap(quote, thirdwebClient, account, () => {
        setShowProgress(true)
        setProgressKey((k) => k + 1)
      })
      setBuyComplete(true)
      setTimeout(() => {
        setBuyComplete(false)
        setShowConfirm(false)
      }, 2000)
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsBuying(false)
    }
  }

  const arbAmount = arbSpend
  const stableAmount = stableOut == null ? null : stableOut

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
              <button className="chip" type="button" disabled={isBuying} onClick={() => disconnect()}>
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
        {showConfirm ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <style>{`@keyframes buy-progress { from { transform: translateX(-100%); } to { transform: translateX(0%); } }`}</style>
            <div className="" style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="coinIcon">
                    <img className="coinLogo" src="/arbitrum-logo.svg" alt="ARB logo" />
                  </div>
                  <div>
                    <div className="coinSym">ARB</div>
                    <div className="subtle">Arbitrum</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{arbAmount == null ? '—' : fmt(arbAmount, 6)}</div>
                  <div className="subtle">~${spendUsd == null ? '—' : fmt(spendUsd, 2)}</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: 18 }}>↓</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="coinIcon">
                    {logoSrc ? <img className="coinLogo" src={logoSrc} alt={`${coin.symbol} logo`} /> : coin.symbol.slice(0, 1)}
                  </div>
                  <div>
                    <div className="coinSym">{coin.symbol}</div>
                    <div className="subtle">Arbitrum One</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{stableAmount == null ? '—' : fmt(stableAmount, 6)}</div>
                  <div className="subtle">~${spendUsd == null ? '—' : fmt(spendUsd, 2)}</div>
                </div>
              </div>
            </div>

            <div className="row" style={{ paddingLeft: 12 }}>
              <div className="subtle">Wallet used</div>
              <div className="right">{isConnected ? shortAddr(address) : '—'}</div>
            </div>
            {buyComplete ? (
              <div style={{ textAlign: 'center', fontWeight: 600, padding: '12px 24px', border: '2px solid #22c55e', borderRadius: 999, background: '#f0fdf4', color: '#22c55e' }}>Buy Complete</div>
            ) : (
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="buyBtn"
                  type="button"
                  style={{ flex: 1, background: '#fff', color: '#111', border: '1px solid #e5e7eb' }}
                  disabled={isBuying}
                  onClick={() => {
                    setBuyError('')
                    setShowConfirm(false)
                  }}
                >
                  Cancel
                </button>
                <button className="buyBtn" type="button" style={{ flex: 1 }} disabled={!canBuy || isBuying} onClick={confirmBuy}>
                  {isBuying ? 'Buying…' : 'Confirm'}
                </button>
              </div>
            )}
            {insufficientBalance ? (
              <div className="err" style={{ textAlign: 'center', paddingTop: 8, maxWidth: '100%' }}>
                Insufficient ARB balance
              </div>
            ) : null}
            {!insufficientBalance && buyError ? (
              <div
                className="err"
                style={{
                  textAlign: 'center',
                  paddingTop: 8,
                  maxWidth: '100%',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                {buyError}
              </div>
            ) : null}
            {isBuying && showProgress ? (
              <div style={{ height: 4, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden', marginTop: 8 }}>
                <div
                  key={progressKey}
                  style={{ height: '100%', width: '100%', background: '#3b82f6', animation: `buy-progress ${buyDurationMs}ms linear` }}
                />
              </div>
            ) : null}
          </div>
        ) : (
        <div>
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

        <button className="buyBtn" type="button" disabled={!isConnected || !canBuy || isBuying} onClick={startBuy}>
          {isBuying ? 'Buying…' : 'Buy'}
        </button>
        {insufficientBalance ? <div className="err" style={{ textAlign: 'center', paddingTop: 8 }}>Insufficient ARB balance</div> : null}
        {!insufficientBalance && buyError ? <div className="err" style={{ textAlign: 'center', paddingTop: 8 }}>{buyError}</div> : null}

        <div className="priceLine subtle">
          {stableUsd && arbUsd ? `1 ARB ≈ $${fmt(arbUsd, 8)} · 1 ${coin.symbol} ≈ $${fmt(stableUsd, 8)}` : ''}
        </div>
        </div>
        )}
      </div>
    </div>
  )
}
