import './style.css'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { Web3Providers } from './web3/Web3Providers'

createRoot(document.getElementById('app')).render(
  <Web3Providers>
    <App />
  </Web3Providers>,
)

