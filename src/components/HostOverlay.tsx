import { useState, useEffect, useRef } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import type { Round } from '../types'

interface Props {
  gameCode: string
  hostSecret: string
  round: Round
  roundIndex: number
  intervalSeconds: number
  isLastRound: boolean
}

export default function HostOverlay({ gameCode, hostSecret, round, roundIndex, intervalSeconds, isLastRound }: Props) {
  const [busy, setBusy] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const advanceClue = httpsCallable(functions, 'advanceClue')
  const hostAction = httpsCallable(functions, 'hostAction')
  const scoreRound = httpsCallable(functions, 'scoreRound')

  const notStarted = round.currentClueIndex === -1
  const allRevealed = round.currentClueIndex >= round.availableClueCount - 1
  const isRevealed = round.revealed

  // Auto-advance clues on a timer
  useEffect(() => {
    if (notStarted || round.timerPaused || isRevealed || allRevealed) return
    timerRef.current = setTimeout(async () => {
      try {
        await advanceClue({ gameCode, hostSecret, roundIndex, fromClueIndex: round.currentClueIndex })
      } catch { /* stale or paused */ }
    }, intervalSeconds * 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [round.currentClueIndex, round.timerPaused, isRevealed, intervalSeconds])

  async function doAction(action: string, payload?: Record<string, unknown>) {
    setBusy(action)
    try {
      if (action === 'scoreRound') {
        await scoreRound({ gameCode, hostSecret, roundIndex })
      } else {
        await hostAction({ gameCode, hostSecret, action, payload })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white border border-[#E8E0D4] rounded-card shadow-xl px-4 py-3 flex items-center gap-2 max-w-lg">
      <span className="text-xs font-semibold text-accent uppercase tracking-wider mr-2">Host</span>

      {notStarted && (
        <button
          onClick={() => doAction('startRound')}
          disabled={!!busy}
          className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-pill hover:bg-[#d44d23] disabled:opacity-50 transition-colors"
        >
          {busy === 'startRound' ? '...' : 'Start round'}
        </button>
      )}

      {!notStarted && !isRevealed && (
        <>
          <button
            onClick={() => doAction(round.timerPaused ? 'resume' : 'pause')}
            disabled={!!busy}
            className="px-3 py-2 border border-[#E8E0D4] text-xs font-semibold rounded-pill hover:bg-[#F8F5F0] disabled:opacity-50 transition-colors"
          >
            {round.timerPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={() => doAction('skipClue')}
            disabled={!!busy || allRevealed}
            className="px-3 py-2 border border-[#E8E0D4] text-xs font-semibold rounded-pill hover:bg-[#F8F5F0] disabled:opacity-50 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => doAction('reveal')}
            disabled={!!busy}
            className="px-3 py-2 bg-[#1a1a1a] text-white text-xs font-semibold rounded-pill hover:bg-black disabled:opacity-50 transition-colors"
          >
            Reveal
          </button>
        </>
      )}

      {isRevealed && (
        <>
          <button
            onClick={() => doAction('scoreRound')}
            disabled={!!busy}
            className="px-3 py-2 border border-[#E8E0D4] text-xs font-semibold rounded-pill hover:bg-[#F8F5F0] disabled:opacity-50 transition-colors"
          >
            {busy === 'scoreRound' ? 'Scoring...' : 'Score round'}
          </button>
          <button
            onClick={() => doAction('nextRound')}
            disabled={!!busy}
            className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-pill hover:bg-[#d44d23] disabled:opacity-50 transition-colors"
          >
            {isLastRound ? 'Finish game' : 'Next round'}
          </button>
        </>
      )}
    </div>
  )
}
