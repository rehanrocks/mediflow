/* src/app/main.jsx - Boots the MediFlow React app with auth and toast providers. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../index.css'
import App from './App.jsx'
import { AuthProvider } from '@shared/context/AuthContext.jsx'
import { ChatProvider } from '@shared/context/ChatContext.jsx'
import { ToastProvider } from '@shared/components/Toast.jsx'
import ChatOverlay from '@shared/components/chat/ChatOverlay.jsx'
import FloatingChatButton from '@shared/components/chat/FloatingChatButton.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ChatProvider>
            <App />
            <FloatingChatButton />
            <ChatOverlay />
          </ChatProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
