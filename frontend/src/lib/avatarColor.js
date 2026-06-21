/* src/lib/avatarColor.js - Hashes names into stable brand-adjacent avatar colors. */
const AVATAR_COLORS = ['#4338CA', '#6366F1', '#8B5CF6', '#0284C7', '#F43F5E']

export function getInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return 'MF'
  }

  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

export function getAvatarColor(name = '') {
  const hash = [...name].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  )

  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
