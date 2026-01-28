import { useQuery } from '@tanstack/react-query'
import { getContract } from 'thirdweb'
import { getBalance } from 'thirdweb/extensions/erc20'
import { arbitrum } from 'thirdweb/chains'
import { thirdwebClient } from '../thirdwebClient'

export function useWalletBalance({ address, tokenAddress }) {
  return useQuery({
    queryKey: ['thirdwebWalletBalance', arbitrum.id, address, tokenAddress],
    enabled: !!thirdwebClient && !!address && !!tokenAddress,
    queryFn: async () => {
      const contract = getContract({
        address: tokenAddress,
        chain: arbitrum,
        client: thirdwebClient,
      })
      return getBalance({ address, contract })
    },
    staleTime: 15_000,
  })
}

