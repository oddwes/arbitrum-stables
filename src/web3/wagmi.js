import { createConfig, http } from 'wagmi'
import { arbitrum } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { unicornConnector } from '@unicorn.eth/autoconnect'

const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID
const factoryAddress = import.meta.env.VITE_THIRDWEB_FACTORY_ADDRESS

const injectedConnector = injected()

const unicorn =
  clientId && factoryAddress
    ? unicornConnector({
        clientId,
        factoryAddress,
        defaultChain: arbitrum.id,
      })
    : undefined

const connectors = [injectedConnector, ...(unicorn ? [unicorn] : [])]

export const wagmiConfig = createConfig({
  chains: [arbitrum],
  connectors,
  transports: {
    [arbitrum.id]: http(),
  },
})

