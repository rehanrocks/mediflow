import { Bot } from 'lucide-react'

import { useChatContext } from '@shared/context/ChatContext'

const TABS = [
  ['users', 'Users'],
  ['groups', 'Groups'],
  ['ai', 'AI'],
]

export function ChatTabBar() {
  const { activeTab, openChat } = useChatContext()

  return (
    <nav className="flex h-11 shrink-0 border-t border-white/10 bg-brand/90">
      {TABS.map(([tab, label]) => {
        const active = activeTab === tab

        return (
          <button
            className={[
              'flex h-full flex-1 items-center justify-center text-[13px] font-medium transition',
              active
                ? 'border-b-2 border-white bg-white/15 text-white'
                : 'text-white/65 hover:bg-white/10 hover:text-white',
            ].join(' ')}
            key={tab}
            onClick={() => openChat(tab)}
            type="button"
          >
            {tab === 'ai' ? <Bot aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> : null}
            {label}
          </button>
        )
      })}
    </nav>
  )
}

export default ChatTabBar
