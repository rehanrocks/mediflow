export function DarkTooltip({ active, label, payload }) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="rounded-xl bg-[#14181F] px-3 py-2 text-white shadow-xl">
      {label ? (
        <p className="font-sans text-[11px] text-white/60">{label}</p>
      ) : null}
      <div className={label ? 'mt-1 space-y-0.5' : 'space-y-0.5'}>
        {payload.map((item, index) => (
          <p
            className="text-[14px] font-semibold text-white"
            key={`${item.dataKey || item.name || 'value'}-${index}`}
          >
            {item.name || item.dataKey}: {item.value}
          </p>
        ))}
      </div>
    </div>
  )
}

export default DarkTooltip
