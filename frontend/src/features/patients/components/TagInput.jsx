import { X } from 'lucide-react'

export function TagInput({ disabled = false, onChange, placeholder, value = [] }) {
  function addTag(rawValue) {
    const tags = String(rawValue || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    if (tags.length === 0) {
      return
    }

    const nextTags = [...value]

    tags.forEach((tag) => {
      if (!nextTags.some((currentTag) => currentTag.toLowerCase() === tag.toLowerCase())) {
        nextTags.push(tag)
      }
    })

    onChange(nextTags)
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ',') {
      return
    }

    event.preventDefault()
    addTag(event.currentTarget.value)
    event.currentTarget.value = ''
  }

  function handleBlur(event) {
    addTag(event.currentTarget.value)
    event.currentTarget.value = ''
  }

  function removeTag(tag) {
    onChange(value.filter((currentTag) => currentTag !== tag))
  }

  return (
    <div className="rounded-control border border-hairline bg-mist/50 px-3 py-2 transition-all duration-150 focus-within:border-brand focus-within:bg-canvas focus-within:ring-2 focus-within:ring-brand/25">
      <div className="flex min-h-[28px] flex-wrap items-center gap-2">
        {value.map((tag) => (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand-light px-2.5 py-1 text-[12px] font-medium text-brand"
            key={tag}
          >
            {tag}
            <button
              className="rounded-full p-0.5 transition hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              disabled={disabled}
              onClick={() => removeTag(tag)}
              type="button"
            >
              <span className="sr-only">Remove {tag}</span>
              <X aria-hidden="true" className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-1 text-[14px] text-ink outline-none placeholder:text-slate/50"
          disabled={disabled}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={value.length ? '' : placeholder}
          type="text"
        />
      </div>
    </div>
  )
}

export default TagInput
