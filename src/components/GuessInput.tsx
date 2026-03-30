import { useState, useMemo } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import type { GuessEntry, Member } from '../types'

interface Props {
  gameCode: string
  memberId: string
  roundIndex: number
  members: Record<string, Member>
  myGuesses: GuessEntry[]
  votingOpen: boolean
}

export default function GuessInput({
  gameCode, memberId, roundIndex, members, myGuesses, votingOpen,
}: Props) {
  const [query, setQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<{ correct: boolean; isFirstCorrect: boolean } | null>(null)

  const alreadyCorrect = myGuesses.some(g => g.correct)
  const attemptsLeft = 3 - myGuesses.length
  const disabled = !votingOpen || alreadyCorrect || attemptsLeft <= 0 || submitting

  // Build autocomplete list — exclude target + clue-givers (they don't know who target is so just exclude self)
  const options = useMemo(() =>
    Object.entries(members)
      .filter(([id]) => id !== memberId) // don't show yourself
      .map(([id, m]) => ({ id, name: m.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [members, memberId]
  )

  const filtered = query.trim()
    ? options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()))
    : []

  async function submitGuess(name: string) {
    setSubmitting(true)
    setQuery('')
    try {
      const fn = httpsCallable<
        { gameCode: string; memberId: string; roundIndex: number; answer: string },
        { correct: boolean; attemptNumber: number; isFirstCorrect: boolean }
      >(functions, 'submitGuess')
      const result = await fn({ gameCode, memberId, roundIndex, answer: name })
      setLastResult({ correct: result.data.correct, isFirstCorrect: result.data.isFirstCorrect })
    } catch {
      setLastResult(null)
    } finally {
      setSubmitting(false)
    }
  }

  // Already correct
  if (alreadyCorrect) {
    return (
      <div className="bg-[#E8F5E9] border border-[#A5D6A7] rounded-card p-4 text-center">
        <div className="text-lg mb-1">&#10003;</div>
        <p className="text-sm font-semibold text-[#2E7D32]">Correct!</p>
      </div>
    )
  }

  // Out of attempts
  if (attemptsLeft <= 0) {
    return (
      <div className="bg-[#FFEBEE] border border-[#EF9A9A] rounded-card p-4 text-center">
        <p className="text-sm font-semibold text-danger">No guesses left</p>
        <p className="text-xs text-[#888] mt-1">-{myGuesses.reduce((s, _, i) => s + (i + 1), 0)} points this round</p>
      </div>
    )
  }

  return (
    <div>
      {/* Feedback from last guess */}
      {lastResult && !lastResult.correct && (
        <div className="bg-[#FFF3E0] border border-[#FFB74D] rounded-card p-3 mb-3 text-center">
          <p className="text-sm font-semibold text-[#E65100]">Wrong! -{myGuesses.length} pts</p>
          <p className="text-xs text-[#888]">{attemptsLeft} guess{attemptsLeft !== 1 ? 'es' : ''} remaining</p>
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setLastResult(null) }}
          placeholder={`Guess who… (${attemptsLeft} left)`}
          disabled={disabled}
          className="w-full h-12 border border-[#E8E0D4] rounded-pill px-5 text-sm outline-none focus:border-accent transition-colors disabled:opacity-50"
          onKeyDown={e => {
            if (e.key === 'Enter' && filtered.length === 1) {
              submitGuess(filtered[0].name)
            }
          }}
        />

        {/* Autocomplete dropdown */}
        {filtered.length > 0 && !disabled && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E8E0D4] rounded-card shadow-lg z-10 max-h-48 overflow-auto">
            {filtered.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => submitGuess(o.name)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F8F5F0] transition-colors first:rounded-t-card last:rounded-b-card"
              >
                {o.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {submitting && (
        <div className="flex items-center justify-center mt-2">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
