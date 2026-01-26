import './style.css'
import { mountBuyCard } from './ui/buyCard'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="page">
    <div id="buy"></div>
  </div>
`

mountBuyCard(document.querySelector<HTMLDivElement>('#buy')!)
