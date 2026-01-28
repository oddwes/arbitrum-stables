import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from './wagmi'
import { UnicornAutoConnectForce } from './UnicornAutoConnectForce'

const queryClient = new QueryClient()

export function Web3Providers({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <UnicornAutoConnectForce debug={import.meta.env.DEV} />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

