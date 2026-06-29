/* eslint-disable react-refresh/only-export-components -- src/shared/components/Toast.jsx - Provides stacked toast notifications and hook access. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    className: 'border-status-completed-text/20 bg-status-completed-bg text-status-completed-text',
    progress: 'bg-status-completed-text',
  },
  error: {
    icon: AlertCircle,
    className: 'border-status-cancelled-text/20 bg-status-cancelled-bg text-status-cancelled-text',
    progress: 'bg-status-cancelled-text',
  },
  info: {
    icon: Info,
    className: 'border-brand/20 bg-brand-light text-brand',
    progress: 'bg-brand',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    progress: 'bg-amber-500',
  },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((currentToasts) =>
      currentToasts.map((toast) =>
        toast.id === id ? { ...toast, leaving: true } : toast,
      ),
    )

    window.setTimeout(() => {
      setToasts((currentToasts) =>
        currentToasts.filter((toast) => toast.id !== id),
      )
    }, 220)
  }, [])

  const showToast = useCallback(
    ({ message, type = 'info' }) => {
      const id = crypto.randomUUID()
      setToasts((currentToasts) => [
        ...currentToasts,
        { id, message, type, leaving: false },
      ])
      window.setTimeout(() => dismiss(id), 3500)
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      success: (message) => showToast({ message, type: 'success' }),
      error: (message) => showToast({ message, type: 'error' }),
      info: (message) => showToast({ message, type: 'info' }),
      warning: (message) => showToast({ message, type: 'warning' }),
      custom: (message, type = 'info') => showToast({ message, type }),
      dismiss,
    }),
    [dismiss, showToast],
  )

  useEffect(() => {
    function handleGlobalToast(event) {
      const { message, type = 'info' } = event.detail || {}

      if (message) {
        showToast({ message, type })
      }
    }

    window.addEventListener('mediflow:toast', handleGlobalToast)

    return () => window.removeEventListener('mediflow:toast', handleGlobalToast)
  }, [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex w-[min(380px,calc(100vw-40px))] flex-col gap-3">
        {toasts.map((toast) => {
          const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info
          const Icon = config.icon

          return (
            <div
              className={[
                'relative overflow-hidden rounded-card border px-4 py-3 shadow-card',
                toast.leaving ? 'animate-drawer-out' : 'animate-slide-left',
                config.className,
              ].join(' ')}
              key={toast.id}
            >
              <div className="flex items-start gap-3">
                <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="min-w-0 flex-1 text-sm font-medium leading-5">
                  {toast.message}
                </p>
                <button
                  className="rounded-md p-0.5 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                  onClick={() => dismiss(toast.id)}
                  type="button"
                >
                  <span className="sr-only">Dismiss toast</span>
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <div
                className={`absolute bottom-0 left-0 h-0.5 ${config.progress}`}
                style={{
                  animation: 'toastProgress 3.5s linear both',
                  width: '100%',
                }}
              />
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }

  return context
}

export default ToastProvider
