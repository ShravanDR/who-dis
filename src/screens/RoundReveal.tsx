import { useMemo } from 'react'
import LeaderboardSidebar from '../components/LeaderboardSidebar'
import type { GameState, Round, Member } from '../types'

interface Props {
  game: GameState
  round: Round
  roundIndex: number
  targetMember: Member
  targetMemberId: string
}

export default function RoundReveal({ game, round, roundIndex, targetMember, targetMemberId }: Props) {
  const giverIds = targetMember.givesFrom
  const guesses = round.guesses ?? {}

  // All clue URLs for this target
  const clueUrls: string[] = []
  for (let slot = 0; slot < 3; slot++) {
    for (const giverId of giverIds) {
      const url = game.clues?.[targetMemberId]?.[giverId]?.[slot as 0 | 1 | 2]
      if (url) clueUrls.push(url)
    }
  }

  // Who guessed correctly?
  const { correctGuessers, wrongGuessers } = useMemo(() => {
    const correct: { name: string; clueIndex: number; attempts: number }[] = []
    const wrong: { name: string; attempts: number }[] = []

    for (const [guesserId, attempts] of Object.entries(guesses)) {
      const sorted = Object.values(attempts).sort((a, b) => a.attemptNumber - b.attemptNumber)
      const correctAttempt = sorted.find(a => a.correct)
      const playerName = game.members[guesserId]?.name ?? '???'
      if (correctAttempt) {
        correct.push({ name: playerName, clueIndex: correctAttempt.clueIndex, attempts: sorted.length })
      } else {
        wrong.push({ name: playerName, attempts: sorted.length })
      }
    }

    correct.sort((a, b) => a.clueIndex - b.clueIndex || a.attempts - b.attempts)

    return { correctGuessers: correct, wrongGuessers: wrong }
  }, [guesses, game.members])

  return (
    <div className="min-h-screen bg-cream px-6 py-10">
      <div className="max-w-5xl mx-auto">
        {/* Round badge + clue credit */}
        <div className="flex items-center justify-between mb-6">
          <div className="inline-flex items-center gap-2 bg-white border border-[#E8E0D4] rounded-pill px-4 py-1.5">
            <span className="text-xs text-[#888] uppercase tracking-wider font-semibold">Round</span>
            <span className="font-lora text-base font-bold text-accent">{roundIndex + 1}/{game.meta.memberCount}</span>
          </div>
          <p className="text-xs text-[#888] font-semibold uppercase tracking-wider">
            Clues by {giverIds.map(id => game.members[id]?.name).join(' & ')}
          </p>
        </div>

        {/*
          Layout: 5-column grid
          Clues take cols 1-3 (3x2 sub-grid), portrait takes cols 4-5
          This keeps both sides height-locked together
        */}
        <div className="grid grid-cols-5 gap-3 mb-10">
          {/* 6 clue cells — each placed explicitly in a 3×2 sub-area */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const col = (i % 3) + 1  // cols 1,2,3
            const row = Math.floor(i / 3) + 1  // rows 1,2
            const url = clueUrls[i]
            return (
              <div
                key={i}
                className="aspect-[3/4] rounded-xl overflow-hidden border border-[#E8E0D4]"
                style={{
                  gridColumn: col,
                  gridRow: row,
                  viewTransitionName: `clue-${i}`,
                } as React.CSSProperties}
              >
                {url ? (
                  <img src={url} alt={`Clue ${i + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#F0ECE4]" />
                )}
              </div>
            )
          })}

          {/* Portrait — spans cols 4-5, rows 1-2 */}
          <div
            className="rounded-2xl overflow-hidden border-4 border-accent shadow-lg"
            style={{ gridColumn: '4 / 6', gridRow: '1 / 3', viewTransitionName: 'reveal-portrait' } as React.CSSProperties}
          >
            {targetMember.photo ? (
              <img
                src={targetMember.photo}
                alt={targetMember.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#F0ECE4] flex items-center justify-center">
                <span className="text-8xl text-[#9A8E7E]">{targetMember.name[0]?.toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Guess results + live leaderboard */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Guess breakdown — left 2 cols */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {correctGuessers.length > 0 && (
              <div className="bg-white border border-[#E8E0D4] rounded-card p-5">
                <h3 className="text-sm font-semibold mb-3 text-[#2E7D32]">Correct guesses</h3>
                <div className="space-y-2">
                  {correctGuessers.map((g, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {i === 0 && <span className="text-accent mr-1">&#9733;</span>}
                        {g.name}
                      </span>
                      <span className="text-xs text-[#888]">
                        After clue {g.clueIndex + 1} · {g.attempts} attempt{g.attempts !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {wrongGuessers.length > 0 && (
              <div className="bg-white border border-[#E8E0D4] rounded-card p-5">
                <h3 className="text-sm font-semibold mb-3 text-danger">Wrong guesses</h3>
                <div className="space-y-2">
                  {wrongGuessers.map((g, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[#888]">{g.name}</span>
                      <span className="text-xs text-[#888]">{g.attempts} attempt{g.attempts !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live leaderboard — right col */}
          <div>
            <LeaderboardSidebar
              scores={game.scores ?? {}}
              members={game.members}
              currentMemberId={null}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
