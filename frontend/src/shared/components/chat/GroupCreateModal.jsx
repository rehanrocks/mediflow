import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { useChatContext } from '@shared/context/ChatContext'
import { filterGroupableUsers } from '@shared/lib/chatRbac'
import ChatAvatar from './ChatAvatar'

function getUserName(user = {}) {
  return (
    user.full_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.name ||
    user.email ||
    'MediFlow User'
  )
}

export function GroupCreateModal({ onClose, onCreated }) {
  const { chatUsers, createGroup, currentUser } = useChatContext()
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [name, setName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])
  const groupableUsers = useMemo(
    () => filterGroupableUsers(chatUsers, currentUser),
    [chatUsers, currentUser],
  )
  const filteredUsers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase()
    const selectedIds = new Set(selectedMembers.map((member) => member.id || member.user_id))

    return groupableUsers
      .filter((user) => !selectedIds.has(user.id || user.user_id))
      .filter((user) => !query || getUserName(user).toLowerCase().includes(query))
      .slice(0, 5)
  }, [groupableUsers, memberSearch, selectedMembers])

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmedName = name.trim()

    if (trimmedName.length < 2) {
      setError('Group name must be at least 2 characters.')
      return
    }

    if (selectedMembers.length === 0) {
      setError('Add at least one member.')
      return
    }

    setIsSubmitting(true)
    setError('')

    const group = await createGroup(
      trimmedName,
      selectedMembers.map((member) => member.id || member.user_id),
    )

    setIsSubmitting(false)

    if (!group) {
      setError('Group could not be created.')
      return
    }

    onCreated?.(group)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[1001] flex items-end justify-end bg-glass-dark px-3 py-3 backdrop-blur-xs sm:px-6 sm:py-6">
      <form
        className="w-full animate-scale-in rounded-card bg-canvas p-5 shadow-card sm:max-w-[380px]"
        onSubmit={handleSubmit}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-[17px] font-bold text-slate-900">Create Group</h2>
          <button
            className="rounded-control p-1.5 text-slate transition hover:bg-mist hover:text-brand"
            onClick={onClose}
            type="button"
          >
            <span className="sr-only">Close</span>
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-900">
            Group Name
          </span>
          <input
            className="h-10 w-full rounded-control border border-hairline bg-mist px-3 text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            onChange={(event) => setName(event.target.value)}
            placeholder="Care Team"
            value={name}
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-900">
            Add Members
          </span>
          <input
            className="h-10 w-full rounded-control border border-hairline bg-mist px-3 text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            onChange={(event) => setMemberSearch(event.target.value)}
            placeholder="Search users to add..."
            value={memberSearch}
          />
        </label>

        {filteredUsers.length > 0 ? (
          <div className="mt-2 max-h-[210px] overflow-y-auto rounded-card border border-hairline bg-canvas">
            {filteredUsers.map((user) => (
              <button
                className="flex w-full items-center gap-2 border-b border-hairline px-3 py-2 text-left last:border-0 hover:bg-mist"
                key={user.id || user.user_id}
                onClick={() => {
                  setSelectedMembers((members) => [...members, user])
                  setMemberSearch('')
                }}
                type="button"
              >
                <ChatAvatar size="sm" user={user} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900">
                  {getUserName(user)}
                </span>
                <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand">
                  {user.role || user.role_slug || 'user'}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {selectedMembers.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedMembers.map((member) => (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2.5 py-1 text-[12px] font-medium text-brand"
                key={member.id || member.user_id}
              >
                {getUserName(member)}
                <button
                  className="rounded-full px-1 hover:bg-brand/10"
                  onClick={() =>
                    setSelectedMembers((members) =>
                      members.filter((item) => (item.id || item.user_id) !== (member.id || member.user_id)),
                    )
                  }
                  type="button"
                >
                  <span className="sr-only">Remove member</span>
                  x
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {error ? <p className="mt-3 text-[12px] font-semibold text-rose-500">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-control border border-hairline px-4 py-2 text-[13px] font-semibold text-slate transition hover:bg-mist"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-control bg-brand px-4 py-2 text-[13px] font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

export default GroupCreateModal
