import { createRoot } from 'react-dom/client'
import App from './App'
import { StoreProvider } from './store'
import { AuthProvider } from './auth'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StoreProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StoreProvider>,
)

// App instalable (solo en el sitio publicado, no en la vista previa)
if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.includes('claude')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
