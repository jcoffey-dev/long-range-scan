import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/**
 * There is one skin so far, and it is the machine as it was. The remaster
 * will bring a provider and a toggle with it; until then the attribute is set
 * once here so the stylesheet has something to key off and nothing has to
 * pretend there is a choice.
 */
document.documentElement.dataset.skin = 'teletype'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
