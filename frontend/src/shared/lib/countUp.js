/* src/shared/lib/countUp.js - Animates dashboard numbers from zero to target values. */
import { useEffect, useState } from 'react'

export function useCountUp(target, duration = 800, precision = 0) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const safeTarget = Number.isFinite(Number(target)) ? Number(target) : 0
    const startTime = performance.now()
    let frameId

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const nextValue = safeTarget * eased

      setValue(
        precision > 0
          ? Number(nextValue.toFixed(precision))
          : Math.round(nextValue),
      )

      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameId)
  }, [duration, precision, target])

  return value
}
