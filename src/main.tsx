import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import App from './App.tsx'
import { PWABadge } from './components/PWABadge'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PWABadge />
    <SpeedInsights />
  </StrictMode>,
)
