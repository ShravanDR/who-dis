import { useEffect, useRef, useState } from 'react'

export function useCountdown(seconds: number, paused: boolean, resetKey: unknown) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setRemaining(seconds)
  }, [resetKey, seconds])

  useEffect(() => {
    if (paused || remaining <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setRemaining(r => Math.max(0, r - 1))
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [paused, resetKey, remaining <= 0])

  return remaining
}
