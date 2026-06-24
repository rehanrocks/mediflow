/* src/app/main.jsx - Boots the MediFlow React app with auth and toast providers. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import App from './App.jsx'
import { AuthProvider } from '@shared/context/AuthContext.jsx'
import { ToastProvider } from '@shared/components/Toast.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
)
