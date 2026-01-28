import { useEffect, useRef } from 'react'
import { UnicornAutoConnect } from '@unicorn.eth/autoconnect'
import { useAccount, useConnect } from 'wagmi'
import { arbitrum } from 'wagmi/chains'

function isUnicornUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get('walletId') === 'inApp' && !!params.get('authCookie')
}

const nextPaint = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

export function UnicornAutoConnectForce({ debug = true }) {
  const { connectAsync, connectors } = useConnect()
  const { isConnected, connector } = useAccount()

  const inFlightRef = useRef(false)
  const attemptsRef = useRef(0)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!isUnicornUrl()) return
    if (isConnected && connector?.id === 'unicorn') return
    if (doneRef.current) return

    const unicornConnector = connectors.find((c) => c.id === 'unicorn')
    if (!unicornConnector) return
    if (inFlightRef.current) return

    inFlightRef.current = true
    let cancelled = false

    const run = async () => {
      await nextPaint()
      if (cancelled) return

      while (attemptsRef.current < 3 && !cancelled) {
        const n = attemptsRef.current + 1
        try {
          await connectAsync({ connector: unicornConnector, chainId: arbitrum.id })
          doneRef.current = true
          return
        } catch (err) {
          attemptsRef.current++
          if (debug) console.warn(`[UnicornAutoConnectForce] connect attempt ${n} failed`, err)
          await new Promise((r) => setTimeout(r, 250 * n))
        }
      }

      doneRef.current = true
    }

    void run()
    return () => {
      cancelled = true
      inFlightRef.current = false
    }
  }, [connectAsync, connectors, isConnected, connector?.id, debug])

  return <UnicornAutoConnect debug={debug} />
}

