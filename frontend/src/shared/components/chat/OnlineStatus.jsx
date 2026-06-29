import { useChatContext } from '@shared/context/ChatContext'
import { getUserId } from '@shared/lib/chatRbac'

function formatLastSeen(value) {
  if (!value) {
    return 'Last seen recently'
  }

  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000))

  if (!Number.isFinite(minutes)) {
    return 'Last seen recently'
  }

  if (minutes < 60) {
    return `Last seen ${minutes}m ago`
  }

  return `Last seen ${Math.round(minutes / 60)}h ago`
}

export function OnlineStatus({ user = {} }) {
  const { onlineUsers } = useChatContext()
  const isOnline = onlineUsers.has(getUserId(user))

  return (
    <p className={`text-[11px] font-medium ${isOnline ? 'text-green-600' : 'text-slate/60'}`}>
      {isOnline ? 'Online' : formatLastSeen(user.last_seen || user.last_login)}
    </p>
  )
}

export default OnlineStatus
