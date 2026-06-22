/* src/components/SkeletonRow.jsx - Renders shimmer skeletons for cards, rows, and forms. */
const BASE =
  'animate-shimmer bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]'

export function SkeletonRow({ columns = 5, index = 0, variant = 'row' }) {
  const style = { animationDelay: `${index * 0.15}s` }

  if (variant === 'stat') {
    return (
      <div className="rounded-card bg-canvas p-6 shadow-card" style={style}>
        <div className={`${BASE} h-10 w-10 rounded-xl`} />
        <div className={`${BASE} mt-5 h-3 w-28 rounded-full`} />
        <div className={`${BASE} mt-4 h-9 w-20 rounded-full`} />
        <div className={`${BASE} mt-4 h-3 w-40 rounded-full`} />
      </div>
    )
  }

  if (variant === 'form') {
    return (
      <div className="space-y-2" style={style}>
        <div className={`${BASE} h-3 w-24 rounded-full`} />
        <div className={`${BASE} h-11 w-full rounded-control`} />
      </div>
    )
  }

  return (
    <tr style={style}>
      {Array.from({ length: columns }).map((_, columnIndex) => (
        <td className="px-5 py-4" key={columnIndex}>
          <div className={`${BASE} h-4 rounded-full`} />
        </td>
      ))}
    </tr>
  )
}

export default SkeletonRow
