import { useMemo, useState } from 'react'
import { Plus, Search, Users2 } from 'lucide-react'

import { useChatContext } from '@shared/context/ChatContext'
import { useDebounce } from '@shared/hooks/useDebounce'
import { canCreateGroup } from '@shared/lib/chatRbac'
import { convKey, formatConvTime } from '@shared/lib/chatUtils'
import ConversationView from '../ConversationView'
import GroupCreateModal from '../GroupCreateModal'
import UnreadBadge from '../UnreadBadge'

function GroupAvatar({ group }) {
  const name = group?.name || 'Group'

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-[#6366F1] text-[14px] font-bold text-white">
      {name[0]?.toUpperCase() || 'G'}
    </span>
  )
}

export function GroupsTab() {
  const {
    activeConversation,
    backToList,
    currentUser,
    groups,
    markAsRead,
    openConversation,
    unreadCounts,
  } = useChatContext()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 200)
  const filteredGroups = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    return groups.filter((group) => !query || String(group.name || '').toLowerCase().includes(query))
  }, [debouncedSearch, groups])
  const canCreate = canCreateGroup(currentUser)

  if (activeConversation.type === 'group') {
    return (
      <ConversationView
        entity={activeConversation.data}
        group
        memberCount={
          activeConversation.data?.member_count || activeConversation.data?.members?.length || 0
        }
        onBack={backToList}
        title={activeConversation.data?.name || 'Group'}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pb-2 pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-slate-900">Groups</h2>
          {canCreate ? (
            <button
              className="inline-flex items-center rounded-control px-2 py-1 text-[12px] font-semibold text-brand transition hover:bg-brand-light"
              onClick={() => setCreateOpen(true)}
              type="button"
            >
              <Plus aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
              New
            </button>
          ) : null}
        </div>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate"
          />
          <input
            className="h-9 w-full rounded-xl border-none bg-mist pl-9 pr-3 text-[13px] text-slate-900 outline-none placeholder:text-slate/50"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search groups"
            value={search}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredGroups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Users2 aria-hidden="true" className="mb-2 h-9 w-9 text-brand/20" />
            <p className="text-[13px] font-semibold italic text-slate">No groups yet</p>
            {canCreate ? (
              <button
                className="mt-2 text-[13px] font-semibold text-brand"
                onClick={() => setCreateOpen(true)}
                type="button"
              >
                Create a group
              </button>
            ) : null}
          </div>
        ) : (
          filteredGroups.map((group) => {
            const key = convKey.group(group.id)
            const unread = unreadCounts.get(key) || 0
            const sender = group.last_message_sender_name
            const preview = group.last_message
              ? `${sender ? `${sender}: ` : ''}${group.last_message.content || ''}`
              : `${group.member_count || group.members?.length || 0} members`

            return (
              <button
                className={[
                  'flex w-full items-center gap-3 border-b border-hairline px-4 py-3 text-left transition hover:bg-mist last:border-0',
                  unread > 0 ? 'bg-brand-light/30' : '',
                ].join(' ')}
                key={group.id}
                onClick={() => {
                  openConversation('group', group.id, group)
                  markAsRead(key)
                }}
                type="button"
              >
                <GroupAvatar group={group} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-semibold text-slate-900">
                      {group.name}
                    </p>
                    <span className="ml-auto shrink-0 text-[10px] font-medium text-slate/60">
                      {formatConvTime(group.updated_at || group.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[12px] text-slate/70">
                      {preview}
                    </p>
                    <UnreadBadge count={unread} />
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {createOpen ? (
        <GroupCreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={(group) => openConversation('group', group.id, group)}
        />
      ) : null}
    </div>
  )
}

export default GroupsTab
