import { ARBITRUM_STABLES, type Stablecoin } from '../data/arbitrumStables'
import { fetchUsdPrice } from '../lib/coingecko'

type Mode = 'usd' | 'arb'

function clampInput(s: string) {
  return s.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
}

function toNum(s: string) {
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function fmt(n: number, max = 6) {
  return n.toLocaleString(undefined, { maximumFractionDigits: max })
}

const LOGO_BY_SYMBOL: Record<string, string> = {
  USDC: '/usdc-logo.svg',
  USDT: '/usdt-logo.svg',
  DAI: '/dai-logo.svg',
  FRAX: '/frax-logo.svg',
}

export function mountBuyCard(root: HTMLDivElement) {
  const coins = ARBITRUM_STABLES
  let coin: Stablecoin = coins[0]!
  let mode: Mode = 'arb'
  let coinMenuOpen = false
  let usdInput = ''
  let arbInput = '0.01'
  let stableUsd: number | null = null
  let arbUsd: number | null = null
  let loading = false
  let error = ''
  let abort: AbortController | null = null
  let cleanupDoc: (() => void) | null = null

  const recalc = () => {
    const au = arbUsd
    if (!au) return
    if (mode === 'usd') {
      const u = toNum(usdInput)
      arbInput = u == null ? '' : String(u / au)
    } else {
      const a = toNum(arbInput)
      usdInput = a == null ? '' : String(a * au)
    }
  }

  const loadPrice = async () => {
    abort?.abort()
    abort = new AbortController()
    loading = true
    error = ''
    render()
    try {
      const [s, a] = await Promise.all([
        fetchUsdPrice(coin.id, abort.signal),
        fetchUsdPrice('arbitrum', abort.signal),
      ])
      stableUsd = s
      arbUsd = a
    } catch (e) {
      if ((e as Error).name !== 'AbortError') error = (e as Error).message || 'Failed to load price'
      stableUsd = null
      arbUsd = null
    } finally {
      loading = false
      recalc()
      render()
    }
  }

  const setMode = (next: Mode) => {
    if (mode === next) return
    mode = next
    recalc()
    render()
  }

  const spendUsd = () => {
    if (mode === 'usd') return toNum(usdInput)
    if (!arbUsd) return null
    const a = toNum(arbInput)
    return a == null ? null : a * arbUsd
  }

  const stableOut = () => {
    const u = spendUsd()
    if (u == null || !stableUsd) return null
    return u / stableUsd
  }

  const canBuy = () => {
    const a = mode === 'arb' ? toNum(arbInput) : (arbUsd ? (toNum(usdInput) ?? 0) / arbUsd : null)
    return typeof a === 'number' && a > 0 && Number.isFinite(a)
  }

  const render = () => {
    cleanupDoc?.()
    cleanupDoc = null

    const logoSrc = LOGO_BY_SYMBOL[coin.symbol] ?? ''
    root.innerHTML = `
      <div class="card">
        <div class="cardHead">
          <div>
            <div class="title">Get ${coin.symbol}</div>
            <div class="subtle">Buy on Arbitrum</div>
          </div>
          <div class="addrChip" title="placeholder address">0x8165…A97A</div>
        </div>

        <div class="panel">
          <div class="coinRow">
            <div class="coinIcon">
              ${
                logoSrc
                  ? `<img class="coinLogo" src="${logoSrc}" alt="${coin.symbol} logo" />`
                  : coin.symbol.slice(0, 1)
              }
            </div>
            <div class="coinMeta">
              <div class="coinSym">${coin.symbol}</div>
              <div class="subtle">Arbitrum</div>
            </div>
            <div class="coinPicker">
              <button class="coinSelectBtn" type="button" aria-haspopup="menu" aria-expanded="${coinMenuOpen}">
                ${coin.symbol}
                <span class="chev">▾</span>
              </button>
              <div class="coinMenu ${coinMenuOpen ? 'open' : ''}" role="menu" aria-label="Select stablecoin">
                ${coins
                  .map(
                    (c) => `
                      <button class="coinItem" type="button" role="menuitem" data-coin="${c.id}">
                        ${c.symbol}
                      </button>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div class="amountBox">
            <div class="amountTop">
              <input
                class="amountInput"
                inputmode="decimal"
                placeholder="0.00"
                value="${mode === 'usd' ? usdInput : arbInput}"
                aria-label="Buy amount"
              />
              <button class="modePill" type="button" aria-label="Toggle input mode">
                <span class="${mode === 'usd' ? 'on' : ''}">USD</span>
                <span class="${mode === 'arb' ? 'on' : ''}">Arbitrum</span>
              </button>
            </div>

            <div class="amountSub">
              ${loading ? `<span class="subtle">Fetching price…</span>` : ''}
              ${!loading && error ? `<span class="err">${error}</span>` : ''}
              ${
                !loading && !error
                  ? `<span class="subtle">${
                      mode === 'usd'
                        ? `≈ ${stableOut() == null ? '—' : fmt(stableOut()!, 6)} ${coin.symbol}`
                        : `≈ $${spendUsd() == null ? '—' : fmt(spendUsd()!, 8)}`
                    }</span>`
                  : ''
              }
            </div>
          </div>

          <div class="chips">
            ${
              mode === 'usd'
                ? ['$5', '$10', '$20']
                    .map((label) => `<button class="chip" type="button" data-usd="${label.slice(1)}">${label}</button>`)
                    .join('')
                : ['0.01', '0.1', '1']
                    .map((label) => `<button class="chip" type="button" data-arb="${label}">${label}</button>`)
                    .join('')
            }
          </div>

          <div class="row">
            <div class="subtle">Current Balance</div>
            <div class="right">ARB</div>
          </div>

          <button class="buyBtn" type="button" ${canBuy() ? '' : 'disabled'}>
            Buy
          </button>

          <div class="priceLine subtle">
            ${
              stableUsd && arbUsd
                ? `1 ARB ≈ $${fmt(arbUsd, 8)} · 1 ${coin.symbol} ≈ $${fmt(stableUsd, 8)}`
                : ''
            }
          </div>
        </div>
      </div>
    `

    const selectBtn = root.querySelector<HTMLButtonElement>('.coinSelectBtn')!
    const input = root.querySelector<HTMLInputElement>('.amountInput')!
    const pill = root.querySelector<HTMLButtonElement>('.modePill')!

    selectBtn.onclick = () => {
      coinMenuOpen = !coinMenuOpen
      render()
    }

    root.querySelectorAll<HTMLButtonElement>('.coinItem').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.coin
        const next = coins.find((c) => c.id === id)
        if (!next) return
        coin = next
        coinMenuOpen = false
        loadPrice()
      }
    })

    if (coinMenuOpen) {
      const onDoc = (e: MouseEvent) => {
        const picker = root.querySelector('.coinPicker')
        if (!picker) return
        if (e.target instanceof Node && picker.contains(e.target)) return
        coinMenuOpen = false
        render()
      }
      document.addEventListener('click', onDoc, { capture: true })
      cleanupDoc = () => document.removeEventListener('click', onDoc, { capture: true })
    }

    input.oninput = () => {
      const v = clampInput(input.value)
      if (mode === 'usd') usdInput = v
      else arbInput = v
      recalc()
      render()
    }

    pill.onclick = () => setMode(mode === 'usd' ? 'arb' : 'usd')

    root.querySelectorAll<HTMLButtonElement>('.chip').forEach((b) => {
      b.onclick = () => {
        const usd = b.dataset.usd
        const arb = b.dataset.arb
        if (usd) {
          usdInput = usd
          mode = 'usd'
        }
        if (arb) {
          arbInput = arb
          mode = 'arb'
        }
        recalc()
        render()
      }
    })
  }

  render()
  loadPrice()
}
