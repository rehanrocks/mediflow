import { useMemo, useState } from 'react'
import { Search, Users } from 'lucide-react'

import SkeletonRow from '@shared/components/SkeletonRow'
import { useChatContext } from '@shared/context/ChatContext'
import { useDebounce } from '@shared/hooks/useDebounce'
import { filterDMableUsers } from '@shared/lib/chatRbac'
import { convKey, formatConvTime } from '@shared/lib/chatUtils'
import ChatAvatar from '../ChatAvatar'
import ConversationView from '../ConversationView'
import UnreadBadge from '../UnreadBadge'

function getUserName(user = {}) {
  return (
    user.full_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.name ||
    user.email ||
    'MediFlow User'
  )
}

function getRoleLabel(role) {
  return String(role || 'Staff')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function UsersTab() {
  const {
    activeConversation,
    backToList,
    chatUsers,
    conversations,
    currentUser,
    isBootstrapping,
    markAsRead,
    openConversation,
    unreadCounts,
  } = useChatContext()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 200)
  const users = useMemo(
    () => filterDMableUsers(chatUsers, currentUser),
    [chatUsers, currentUser],
  )
  const filteredUsers = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    return users.filter((user) => !query || getUserName(user).toLowerCase().includes(query))
  }, [debouncedSearch, users])

  if (activeConversation.type === 'dm') {
    return (
      <ConversationView
        entity={activeConversation.data}
        onBack={backToList}
        title={getUserName(activeConversation.data)}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-3 pb-2 pt-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate"
          />
          <input
            className="h-9 w-full rounded-xl border-none bg-mist pl-9 pr-3 text-[13px] text-slate-900 outline-none placeholder:text-slate/50"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users"
            value={search}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isBootstrapping ? (
          <div className="space-y-1 px-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonRow index={index} key={index} variant="chat" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Users aria-hidden="true" className="mb-2 h-9 w-9 text-brand/20" />
            <p className="text-[13px] font-semibold italic text-slate">No users available</p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const key = convKey.dm(user.id || user.user_id)
            const conversation = conversations.get(user.id || user.user_id) || {}
            const unread = unreadCounts.get(key) || 0

            return (
              <button
                className={[
                  'flex w-full items-center gap-3 border-b border-hairline px-4 py-3 text-left transition hover:bg-mist last:border-0',
                  unread > 0 ? 'bg-brand-light/30' : '',
                ].join(' ')}
                key={user.id || user.user_id}
                onClick={() => {
                  openConversation('dm', user.id || user.user_id, user)
                  markAsRead(key)
                }}
                type="button"
              >
                <ChatAvatar showOnline size="md" user={user} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-semibold text-slate-900">
                      {getUserName(user)}
                    </p>
                    <span className="ml-auto shrink-0 text-[10px] font-medium text-slate/60">
                      {formatConvTime(conversation.updated_at || conversation.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p
                      className={[
                        'min-w-0 flex-1 truncate text-[12px]',
                        conversation.last_message ? 'text-slate/70' : 'italic text-slate/50',
                      ].join(' ')}
                    >
                      {conversation.last_message || getRoleLabel(user.role || user.role_slug)}
                    </p>
                    <UnreadBadge count={unread} />
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export default UsersTab
