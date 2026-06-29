export function TypingIndicator({ label }) {
  return (
    <div className="flex justify-start py-1">
      <div className="max-w-[72%] rounded-[18px] rounded-bl-[4px] bg-mist px-4 py-2 sm:max-w-[72%]">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((index) => (
            <span
              className="h-2 w-2 animate-bounce rounded-full bg-slate/40"
              key={index}
              style={{
                animationDelay: `${index * 0.15}s`,
                animationDuration: '0.8s',
              }}
            />
          ))}
        </div>
        {label ? <p className="mt-2 text-[11px] font-medium text-slate">{label}</p> : null}
      </div>
    </div>
  )
}

export default TypingIndicator
