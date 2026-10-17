import { createRoot } from 'react-dom/client'
import App from './App'
import { StoreProvider } from './store'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
)

// App instalable (solo en el sitio publicado, no en la vista previa)
if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.includes('claude')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
