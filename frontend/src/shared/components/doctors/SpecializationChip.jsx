/* src/shared/components/doctors/SpecializationChip.jsx - Specialization chips. */

export function SpecializationChip({
  compact = true,
  specialization,
  specializations = [],
}) {
  const values = specialization ? [specialization] : specializations
  const visibleChips = compact ? values.slice(0, 3) : values
  const remaining = compact ? Math.max(values.length - 3, 0) : 0

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleChips.map((spec) => (
        <span
          className="inline-flex items-center rounded-full border border-brand/20 bg-brand-light px-2.5 py-0.5 font-sans text-[11px] font-medium text-brand"
          key={spec}
        >
          {spec}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="inline-flex items-center text-[11px] font-medium text-slate">
          +{remaining} more
        </span>
      ) : null}
    </div>
  )
}

export default SpecializationChip
