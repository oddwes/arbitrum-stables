import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UnicornAutoConnect } from '@unicorn.eth/autoconnect'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from './wagmi'

const queryClient = new QueryClient()

export function Web3Providers({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <UnicornAutoConnect debug={import.meta.env.DEV} />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

