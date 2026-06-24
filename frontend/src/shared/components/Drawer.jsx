/* src/shared/components/Drawer.jsx - Renders a focus-trapped right-side drawer portal. */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Drawer({
  bodyClassName = 'px-6 py-5',
  children,
  footer,
  onClose,
  open,
  subtitle,
  title,
  widthClass = 'max-w-[480px]',
}) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusable = panelRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)
    focusable?.[0]?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }

      if (event.key !== 'Tab') {
        return
      }

      const elements = Array.from(
        panelRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [],
      )

      if (elements.length === 0) {
        event.preventDefault()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close drawer"
        className="absolute inset-0 h-full w-full bg-glass-dark backdrop-blur-xs animate-fade-in"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-modal="true"
        className={[
          'fixed right-0 top-0 flex h-full w-full flex-col bg-canvas shadow-2xl animate-drawer-in',
          widthClass,
        ].join(' ')}
        ref={panelRef}
        role="dialog"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-hairline bg-canvas/80 px-6 py-5 backdrop-blur-sm">
          <div>
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-[13px] font-medium text-slate">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            className="rounded-lg p-1.5 text-slate transition-colors hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            onClick={onClose}
            type="button"
          >
            <span className="sr-only">Close drawer</span>
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>
        <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
        {footer ? (
          <footer className="sticky bottom-0 border-t border-hairline bg-canvas/80 px-6 py-4 backdrop-blur-sm">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body,
  )
}

export default Drawer
