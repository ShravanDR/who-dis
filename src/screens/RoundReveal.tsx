import type { GameState, Round, Member } from '../types'

interface Props {
  game: GameState
  round: Round
  roundIndex: number
  targetMember: Member
  targetMemberId: string
}

export default function RoundReveal({ game, round, targetMember, targetMemberId }: Props) {
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
  const correctGuessers: { name: string; clueIndex: number; attempts: number }[] = []
  const wrongGuessers: { name: string; attempts: number }[] = []

  for (const [guesserId, attempts] of Object.entries(guesses)) {
    const sorted = Object.values(attempts).sort((a, b) => a.attemptNumber - b.attemptNumber)
    const correct = sorted.find(a => a.correct)
    const playerName = game.members[guesserId]?.name ?? '???'
    if (correct) {
      correctGuessers.push({ name: playerName, clueIndex: correct.clueIndex, attempts: sorted.length })
    } else {
      wrongGuessers.push({ name: playerName, attempts: sorted.length })
    }
  }

  correctGuessers.sort((a, b) => a.clueIndex - b.clueIndex || a.attempts - b.attempts)

  return (
    <div className="min-h-screen bg-cream px-6 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Reveal header */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-full mx-auto overflow-hidden border-4 border-accent mb-4">
            {targetMember.photo ? (
              <img src={targetMember.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#F0ECE4] flex items-center justify-center text-3xl">
                {targetMember.name[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <h2 className="font-lora text-3xl font-bold text-[#1a1a1a]">{targetMember.name}!</h2>
          <p className="text-[#888] text-sm mt-1">
            Clues by {giverIds.map(id => game.members[id]?.name).join(' & ')}
          </p>
        </div>

        {/* All clues revealed */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-8">
          {clueUrls.map((url, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl overflow-hidden">
              <img src={url} alt={`Clue ${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>

        {/* Correct guessers */}
        {correctGuessers.length > 0 && (
          <div className="bg-white border border-[#E8E0D4] rounded-card p-5 mb-4">
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

        {/* Wrong guessers */}
        {wrongGuessers.length > 0 && (
          <div className="bg-white border border-[#E8E0D4] rounded-card p-5 mb-8">
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
    </div>
  )
}
