import { useEffect, useState } from 'react'
import { ref, onValue, off } from 'firebase/database'
import { db } from '../firebase'
import type { GameState } from '../types'

export function useGame(gameCode: string | null): {
  game: GameState | null
  loading: boolean
  error: string | null
} {
  const [game, setGame] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameCode) {
      setLoading(false)
      return
    }

    const gameRef = ref(db, `games/${gameCode}`)
    setLoading(true)

    const unsubscribe = onValue(
      gameRef,
      (snapshot) => {
        setLoading(false)
        if (snapshot.exists()) {
          setGame(snapshot.val() as GameState)
          setError(null)
        } else {
          setGame(null)
          setError('Game not found')
        }
      },
      (err) => {
        setLoading(false)
        setError(err.message)
      }
    )

    return () => off(gameRef, 'value', unsubscribe)
  }, [gameCode])

  return { game, loading, error }
}
