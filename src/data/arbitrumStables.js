const ALL_STABLES = [
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  { id: 'tether', symbol: 'USDT', name: 'Tether', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
  { id: 'dai', symbol: 'DAI', name: 'Dai', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' },
  { id: 'frax', symbol: 'FRAX', name: 'Frax', address: '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F' },
]

export const ARBITRUM_STABLES = (() => {
  const envAddresses = import.meta.env.VITE_ALLOWED_STABLECOINS
  if (!envAddresses) return ALL_STABLES
  
  const allowed = envAddresses.split(',').map(a => a.trim().toLowerCase())
  return ALL_STABLES.filter(s => allowed.includes(s.address.toLowerCase()))
})()

