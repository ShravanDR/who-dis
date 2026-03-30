import type { Round, Member } from '../types'

interface Props {
  round: Round
  members: Record<string, Member>
  targetMemberId: string
}

export default function PlayerChips({ round, members, targetMemberId }: Props) {
  const target = members[targetMemberId]
  const giverIds = target?.givesFrom ?? []
  const guesses = round.guesses ?? {}

  // Build player status list (excluding target and givers)
  const players = Object.entries(members)
    .filter(([id]) => id !== targetMemberId && !giverIds.includes(id))
    .map(([id, m]) => {
      const playerGuesses = guesses[id] ? Object.values(guesses[id]) : []
      const hasCorrect = playerGuesses.some(g => g.correct)
      const attemptCount = playerGuesses.length
      const status = hasCorrect ? 'correct' as const
        : attemptCount >= 3 ? 'eliminated' as const
        : attemptCount > 0 ? 'guessing' as const
        : 'thinking' as const
      return { id, name: m.name, photo: m.photo, status }
    })

  return (
    <div className="flex flex-wrap gap-1.5">
      {players.map(p => (
        <div
          key={p.id}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-medium transition-all ${
            p.status === 'correct' ? 'bg-[#E8F5E9] text-[#2E7D32]'
            : p.status === 'eliminated' ? 'bg-[#FFEBEE] text-[#C62828] line-through opacity-60'
            : p.status === 'guessing' ? 'bg-[#FFF3E0] text-[#E65100]'
            : 'bg-[#F0ECE4] text-[#888]'
          }`}
        >
          {p.status === 'correct' && <span>&#10003;</span>}
          {p.status === 'eliminated' && <span>&#10007;</span>}
          {p.status === 'guessing' && <span>...</span>}
          {p.name}
        </div>
      ))}
    </div>
  )
}
