export type Stablecoin = {
  id: string
  symbol: string
  name: string
}

export const ARBITRUM_STABLES: Stablecoin[] = [
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'dai', symbol: 'DAI', name: 'Dai' },
  { id: 'frax', symbol: 'FRAX', name: 'Frax' },
]
