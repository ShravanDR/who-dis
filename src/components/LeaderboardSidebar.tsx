import type { MemberScore, Member } from '../types'

interface Props {
  scores: Record<string, MemberScore>
  members: Record<string, Member>
  currentMemberId: string | null
}

export default function LeaderboardSidebar({ scores, members, currentMemberId }: Props) {
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

  return (
    <div className="bg-white border border-[#E8E0D4] rounded-card overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F0ECE4]">
        <h3 className="text-sm font-semibold text-[#1a1a1a]">Leaderboard</h3>
      </div>
      <div className="divide-y divide-[#F8F5F0]">
        {sorted.map((p, rank) => (
          <div
            key={p.id}
            className={`flex items-center gap-2.5 px-4 py-2.5 ${p.id === currentMemberId ? 'bg-[#FFF8F5]' : ''}`}
          >
            <span className={`w-5 text-xs font-bold text-center ${rank < 3 ? 'text-accent' : 'text-[#C4B9A8]'}`}>
              {rank + 1}
            </span>
            <div className="w-7 h-7 rounded-full bg-[#F0ECE4] flex items-center justify-center text-xs overflow-hidden flex-shrink-0">
              {p.photo && (p.photo.startsWith('http') || p.photo.startsWith('/'))
                ? <img src={p.photo} alt="" className="w-full h-full object-cover" />
                : <span>{p.name[0]?.toUpperCase()}</span>
              }
            </div>
            <span className="flex-1 text-xs font-medium truncate">{p.name}</span>
            <div className="text-right">
              <span className="text-sm font-bold text-[#1a1a1a]">{p.total}</span>
              <div className="text-[9px] text-[#888] leading-tight">
                G:{p.guessing} C:{p.clueing}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
