export function UnreadBadge({ count = 0 }) {
  const safeCount = Number(count || 0)

  if (safeCount <= 0) {
    return null
  }

  return (
    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
      {safeCount > 99 ? '99+' : safeCount}
    </span>
  )
}

export default UnreadBadge
