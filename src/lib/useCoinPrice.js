import { useQuery } from '@tanstack/react-query'
import { fetchUsdPrice } from './coingecko'

export function useCoinPrice(coingeckoId) {
  return useQuery({
    queryKey: ['coinPrice', coingeckoId],
    queryFn: ({ signal }) => fetchUsdPrice(coingeckoId, signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}
