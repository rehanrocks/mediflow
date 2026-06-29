import { X } from 'lucide-react'

import { useChatContext } from '@shared/context/ChatContext'
import ChatTabBar from './ChatTabBar'
import AITab from './tabs/AITab'
import GroupsTab from './tabs/GroupsTab'
import UsersTab from './tabs/UsersTab'

export function ChatOverlay() {
  const { activeTab, chatAvailable, closeChat, isOpen } = useChatContext()

  if (!chatAvailable) {
    return null
  }

  return (
    <section
      aria-hidden={!isOpen}
      className={[
        'fixed bottom-20 right-3 z-[998] h-[min(580px,calc(100vh-32px))] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-card border border-hairline bg-canvas shadow-[0_8px_48px_rgba(20,24,31,0.18)] transition-all duration-200 sm:bottom-24 sm:right-6',
        isOpen
          ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none translate-y-3 scale-95 opacity-0',
      ].join(' ')}
    >
      <div className="flex h-full flex-col">
        <header className="flex h-[52px] shrink-0 items-center justify-between bg-brand px-4">
          <h2 className="text-[15px] font-semibold text-white">MediFlow Chat</h2>
          <button
            className="rounded-control p-1.5 text-white transition hover:bg-white/10"
            onClick={closeChat}
            type="button"
          >
            <span className="sr-only">Close chat</span>
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>
        <ChatTabBar />
        <div className="relative flex-1 overflow-hidden bg-canvas">
          <div className={activeTab === 'users' ? 'h-full' : 'hidden h-full'}>
            <UsersTab />
          </div>
          <div className={activeTab === 'groups' ? 'h-full' : 'hidden h-full'}>
            <GroupsTab />
          </div>
          <div className={activeTab === 'ai' ? 'h-full' : 'hidden h-full'}>
            <AITab />
          </div>
        </div>
      </div>
    </section>
  )
}

export default ChatOverlay
