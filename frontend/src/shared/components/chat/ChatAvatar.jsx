import { useChatContext } from '@shared/context/ChatContext'
import { getAvatarColor, getInitials } from '@shared/lib/avatarColor'
import { getUserId } from '@shared/lib/chatRbac'

const SIZES = {
  lg: 'h-11 w-11 text-[14px]',
  md: 'h-9 w-9 text-[13px]',
  sm: 'h-7 w-7 text-[11px]',
}

function getName(user = {}) {
  return (
    user.full_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.name ||
    user.email ||
    'User'
  )
}

export function ChatAvatar({ showOnline = false, size = 'md', user = {} }) {
  const { onlineUsers } = useChatContext()
  const name = getName(user)
  const online = showOnline && onlineUsers.has(getUserId(user))

  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={[
          'flex items-center justify-center rounded-full font-medium text-white',
          SIZES[size] || SIZES.md,
        ].join(' ')}
        style={{ backgroundColor: getAvatarColor(name) }}
        title={name}
      >
        {getInitials(name)}
      </span>
      {online ? (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-canvas" />
      ) : null}
    </span>
  )
}

export default ChatAvatar
