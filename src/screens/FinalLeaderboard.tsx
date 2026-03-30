import { useNavigate } from 'react-router-dom'
import type { GameState } from '../types'

interface Props {
  game: GameState
  memberId: string | null
}

export default function FinalLeaderboard({ game, memberId }: Props) {
  const navigate = useNavigate()
  const scores = game.scores ?? {}
  const members = game.members

  const sorted = Object.entries(scores)
    .map(([id, score]) => ({
      id,
      name: members[id]?.name ?? '???',
      photo: members[id]?.photo ?? '',
      ...score,
    }))
    .sort((a, b) =>
      b.total - a.total
      || b.correctGuessCount - a.correctGuessCount
      || a.name.localeCompare(b.name)
    )

  const winner = sorted[0]
  const podium = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  return (
    <div className="min-h-screen bg-cream px-6 py-10">
      <div className="max-w-lg mx-auto text-center">
        {/* Title */}
        <h1 className="font-lora text-4xl font-bold text-[#1a1a1a] mb-2">Game over!</h1>
        <p className="text-[#888] mb-10">Here's how everyone did</p>

        {/* Winner */}
        {winner && (
          <div className="mb-10">
            <div className="w-28 h-28 rounded-full mx-auto overflow-hidden border-4 border-accent mb-4 shadow-lg">
              {winner.photo && (winner.photo.startsWith('http') || winner.photo.startsWith('/'))
                ? <img src={winner.photo} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-[#FFF0EB] flex items-center justify-center text-4xl">{winner.name[0]}</div>
              }
            </div>
            <h2 className="font-lora text-2xl font-bold text-accent">{winner.name}</h2>
            <div className="text-4xl font-bold text-[#1a1a1a] mt-1">{winner.total} pts</div>
            <div className="text-xs text-[#888] mt-1">
              Guessing: {winner.guessing} · Clueing: {winner.clueing} · {winner.correctGuessCount} correct
            </div>
          </div>
        )}

        {/* Podium */}
        <div className="flex justify-center gap-4 mb-8">
          {podium.map((p, rank) => (
            <div key={p.id} className={`text-center ${rank === 0 ? 'order-2' : rank === 1 ? 'order-1' : 'order-3'}`}>
              <div className={`w-14 h-14 rounded-full mx-auto overflow-hidden border-2 mb-2 ${
                rank === 0 ? 'border-accent' : rank === 1 ? 'border-[#C0C0C0]' : 'border-[#CD7F32]'
              }`}>
                {p.photo && (p.photo.startsWith('http') || p.photo.startsWith('/'))
                  ? <img src={p.photo} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-[#F0ECE4] flex items-center justify-center text-lg">{p.name[0]}</div>
                }
              </div>
              <p className="text-xs font-semibold">{p.name}</p>
              <p className="text-sm font-bold text-[#1a1a1a]">{p.total}</p>
              <p className="text-[10px] text-[#888]">#{rank + 1}</p>
            </div>
          ))}
        </div>

        {/* Rest of the leaderboard */}
        {rest.length > 0 && (
          <div className="bg-white border border-[#E8E0D4] rounded-card divide-y divide-[#F0ECE4] text-left mb-8">
            {rest.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 px-5 py-3 ${p.id === memberId ? 'bg-[#FFF8F5]' : ''}`}
              >
                <span className="w-6 text-sm font-bold text-[#C4B9A8] text-center">{i + 4}</span>
                <div className="w-8 h-8 rounded-full bg-[#F0ECE4] flex items-center justify-center text-sm overflow-hidden flex-shrink-0">
                  {p.photo && (p.photo.startsWith('http') || p.photo.startsWith('/'))
                    ? <img src={p.photo} alt="" className="w-full h-full object-cover" />
                    : <span>{p.name[0]?.toUpperCase()}</span>
                  }
                </div>
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                <div className="text-right">
                  <span className="text-sm font-bold">{p.total}</span>
                  <div className="text-[10px] text-[#888]">G:{p.guessing} C:{p.clueing}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          className="py-3 px-8 border border-[#E8E0D4] rounded-pill text-sm font-semibold hover:bg-[#F8F5F0] transition-colors"
        >
          Back to home
        </button>
      </div>
    </div>
  )
}
