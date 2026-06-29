import { MessageSquare } from 'lucide-react'

import { useChatContext } from '@shared/context/ChatContext'
import UnreadBadge from './UnreadBadge'

export function FloatingChatButton() {
  const { chatAvailable, closeChat, isOpen, openChat, totalUnread } = useChatContext()

  if (!chatAvailable) {
    return null
  }

  return (
    <button
      className={[
        'fixed bottom-4 right-4 z-[999] flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-white shadow-[0_4px_24px_rgba(67,56,202,0.4)] transition-all duration-200 hover:bg-brand-dark active:scale-95 sm:bottom-6 sm:right-6',
        isOpen ? 'bg-brand/70' : 'bg-brand',
      ].join(' ')}
      onClick={() => (isOpen ? closeChat() : openChat('users'))}
      type="button"
    >
      <span className="sr-only">{isOpen ? 'Close chat' : 'Open chat'}</span>
      {totalUnread > 0 ? (
        <span className="absolute inset-0 rounded-full bg-brand/30 animate-ping" />
      ) : null}
      <MessageSquare aria-hidden="true" className="relative h-[22px] w-[22px]" />
      <span className="absolute -right-1 -top-1">
        <UnreadBadge count={totalUnread} />
      </span>
    </button>
  )
}

export default FloatingChatButton
