/* src/shared/lib/motion.js - Provides tiny viewport and stagger motion helpers. */
import { useEffect, useState } from 'react'

export const stagger = (index, base = 0.05) => ({
  animationDelay: `${index * base}s`,
})

export function useFadeUp(ref, threshold = 0.1) {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current

    if (!element) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [ref, threshold])

  return { inView }
}
