/* src/components/Avatar.jsx - Displays deterministic initials avatars with optional online state. */
import { getAvatarColor, getInitials } from '../lib/avatarColor'

const SIZES = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-[13px]',
  lg: 'h-11 w-11 text-sm',
}

export function Avatar({ name = 'MediFlow User', online = false, size = 'md' }) {
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={[
          'flex items-center justify-center rounded-full font-mono font-medium text-white ring-2 ring-white ring-offset-1 transition-transform hover:scale-105',
          SIZES[size] || SIZES.md,
        ].join(' ')}
        style={{ backgroundColor: getAvatarColor(name) }}
        title={name}
      >
        {getInitials(name)}
      </span>
      {online ? (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#22C55E]" />
      ) : null}
    </span>
  )
}

export default Avatar
