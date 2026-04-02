import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameState, MemberScore } from '../types'

interface Props {
  game: GameState
  memberId: string | null
}

type Page = 'guessing' | 'clueing' | 'combined'

const PAGE_ORDER: Page[] = ['guessing', 'clueing', 'combined']

const PAGE_CONFIG: Record<Page, {
  title: string
  subtitle: string
  sortKey: (s: MemberScore) => number
  statLabel: (s: MemberScore) => string
}> = {
  guessing: {
    title: 'Best Guessers',
    subtitle: 'Who figured out the most?',
    sortKey: s => s.guessing,
    statLabel: s => `${s.correctGuessCount} correct`,
  },
  clueing: {
    title: 'Best Clue Givers',
    subtitle: 'Whose clues helped the most?',
    sortKey: s => s.clueing,
    statLabel: s => `${s.clueing} pts`,
  },
  combined: {
    title: 'Final Standings',
    subtitle: 'The overall champion',
    sortKey: s => s.total,
    statLabel: s => `G:${s.guessing} + C:${s.clueing}`,
  },
}

export default function FinalLeaderboard({ game, memberId: _memberId }: Props) {
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)
  const page = PAGE_ORDER[pageIndex]
  const config = PAGE_CONFIG[page]

  const scores = game.scores ?? {}
  const members = game.members

  const sorted = Object.entries(scores)
    .map(([id, score]) => ({
      id,
      name: members[id]?.name ?? '???',
      photo: members[id]?.photo ?? '',
      score,
      sortValue: config.sortKey(score),
    }))
    .sort((a, b) =>
      b.sortValue - a.sortValue
      || b.score.total - a.score.total
      || a.name.localeCompare(b.name)
    )

  // Podium order: [#2, #1, #3] for visual layout
  const podiumOrder = sorted.length >= 3
    ? [sorted[1], sorted[0], sorted[2]]
    : sorted.slice(0, 3)

  const rest = sorted.slice(3)
  const isLastPage = pageIndex === PAGE_ORDER.length - 1

  // Portrait card heights per podium position: [#2, #1, #3]
  const podiumConfig = sorted.length >= 3
    ? [
        { cardHeight: 'h-52', scoreSize: 'text-lg', rank: 2 },
        { cardHeight: 'h-64', scoreSize: 'text-2xl', rank: 1 },
        { cardHeight: 'h-44', scoreSize: 'text-base', rank: 3 },
      ]
    : sorted.map((_, i) => ({
        cardHeight: i === 0 ? 'h-64' : 'h-52',
        scoreSize: i === 0 ? 'text-2xl' : 'text-lg',
        rank: i + 1,
      }))

  return (
    <div className="min-h-screen bg-cream px-6 py-10">
      <div className="max-w-lg mx-auto">
        {/* Page indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {PAGE_ORDER.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === pageIndex ? 'bg-accent w-6' : i < pageIndex ? 'bg-accent/30 w-1.5' : 'bg-[#E8E0D4] w-1.5'
              }`}
            />
          ))}
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-lora text-3xl font-bold text-[#1a1a1a] mb-2">{config.title}</h1>
          <p className="text-[#888] text-sm">{config.subtitle}</p>
        </div>

        {/* Podium — portrait cards as columns */}
        <div className="bg-white border border-[#E8E0D4] rounded-card p-5 mb-6">
          <div className="flex items-end justify-center gap-3">
            {podiumOrder.map((p, vi) => {
              const pc = podiumConfig[vi]
              const isFirst = pc.rank === 1
              const hasPhoto = p.photo && (p.photo.startsWith('http') || p.photo.startsWith('/'))
              return (
                <div key={p.id} className="flex-1 flex flex-col items-center">
                  {/* Score above card */}
                  <p className={`font-bold text-accent mb-2 ${pc.scoreSize}`}>{p.sortValue}</p>

                  {/* Portrait card */}
                  <div className={`w-full ${pc.cardHeight} rounded-xl overflow-hidden ${
                    isFirst ? 'ring-2 ring-accent' : ''
                  }`}>
                    {hasPhoto
                      ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-[#F0ECE4] flex flex-col items-center justify-center gap-2">
                          <span className="text-3xl font-bold text-[#C4B9A8]">{p.name[0]?.toUpperCase()}</span>
                          <span className="text-xs text-[#888]">{p.name}</span>
                        </div>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Rest of players — simple rows on beige */}
        {rest.length > 0 && (
          <div className="mb-8">
            {rest.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 px-2 py-3 ${i > 0 ? 'border-t border-[#E8E0D4]' : ''}`}
              >
                <span className="w-6 text-sm font-bold text-[#C4B9A8] text-center">{i + 4}</span>
                <div className="w-9 h-9 rounded-full bg-[#F0ECE4] flex items-center justify-center text-sm overflow-hidden flex-shrink-0">
                  {p.photo && (p.photo.startsWith('http') || p.photo.startsWith('/'))
                    ? <img src={p.photo} alt="" className="w-full h-full object-cover" />
                    : <span>{p.name[0]?.toUpperCase()}</span>
                  }
                </div>
                <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                <span className="text-sm font-bold">{p.sortValue}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {pageIndex > 0 && (
            <button
              onClick={() => { setPageIndex(i => i - 1); window.scrollTo(0, 0) }}
              className="flex-1 py-4 border border-[#E8E0D4] text-[#888] font-semibold rounded-pill hover:bg-[#F8F5F0] transition-colors"
            >
              ← Back
            </button>
          )}
          {!isLastPage ? (
            <button
              onClick={() => { setPageIndex(i => i + 1); window.scrollTo(0, 0) }}
              className="flex-1 py-4 bg-accent text-white font-semibold rounded-pill hover:bg-[#d44d23] transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-4 bg-accent text-white font-semibold rounded-pill hover:bg-[#d44d23] transition-colors"
            >
              Back to home
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
