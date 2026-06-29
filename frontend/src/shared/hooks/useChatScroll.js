import { useEffect, useRef, useState } from 'react'

export function useChatScroll(messages = [], hasMore = false) {
  const bottomRef = useRef(null)
  const containerRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [autoScroll, messages.length])

  function onScroll(event) {
    const element = event.currentTarget
    const nearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80

    setAutoScroll(nearBottom)

    return hasMore && element.scrollTop <= 4
  }

  return { autoScroll, bottomRef, containerRef, onScroll }
}

export default useChatScroll
