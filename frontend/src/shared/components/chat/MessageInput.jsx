import { useEffect, useRef } from 'react'
import { Send } from 'lucide-react'

export function MessageInput({
  disabled = false,
  onBlur,
  onChange,
  onSend,
  onTyping,
  placeholder = 'Message...',
  value,
}) {
  const inputRef = useRef(null)
  const empty = !String(value || '').trim()

  useEffect(() => {
    const element = inputRef.current

    if (!element) {
      return
    }

    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 96)}px`
  }, [value])

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!empty && !disabled) {
        onSend?.()
      }
    }
  }

  return (
    <div className="flex shrink-0 items-end gap-2 border-t border-hairline bg-canvas px-3 py-2">
      <textarea
        className="max-h-[96px] flex-1 resize-none overflow-y-auto rounded-xl border-none bg-mist px-4 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate/50"
        disabled={disabled}
        onBlur={onBlur}
        onChange={(event) => {
          onChange?.(event.target.value)
          onTyping?.()
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        ref={inputRef}
        rows={1}
        value={value}
      />
      <button
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || empty}
        onClick={onSend}
        type="button"
      >
        <span className="sr-only">Send message</span>
        <Send aria-hidden="true" className="h-4 w-4 -rotate-45" />
      </button>
    </div>
  )
}

export default MessageInput
