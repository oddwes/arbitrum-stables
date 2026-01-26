export async function fetchUsdPrice(coingeckoId: string, signal?: AbortSignal) {
  const url = new URL('https://api.coingecko.com/api/v3/simple/price')
  url.searchParams.set('ids', coingeckoId)
  url.searchParams.set('vs_currencies', 'usd')

  const res = await fetch(url.toString(), { signal })
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`)

  const json = (await res.json()) as Record<string, { usd?: number }>
  const usd = json?.[coingeckoId]?.usd
  if (typeof usd !== 'number' || !Number.isFinite(usd)) throw new Error('Invalid price')
  return usd
}
