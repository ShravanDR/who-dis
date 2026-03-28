import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ref as dbRef, update } from 'firebase/database'
import { db } from '../firebase'
import { useGame } from '../hooks/useGame'
import { useLocalPlayer } from '../hooks/useLocalPlayer'
import ImageUploadSlot from '../components/ImageUploadSlot'
import MemberAvatar from '../components/MemberAvatar'

export default function ClueSubmission() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { game, loading } = useGame(code)
  const { memberId } = useLocalPlayer()

  // Local state: track uploaded URLs before persisting
  // Structure: slots[targetId][slotIndex] = url | null
  const [slots, setSlots] = useState<Record<string, (string | null)[]>>({})

  const me = game?.members[memberId ?? '']
  const assignedTo = me?.assignedTo ?? []

  // Initialise slots from existing clue data
  useEffect(() => {
    if (!game || !memberId) return
    const initial: Record<string, (string | null)[]> = {}
    for (const targetId of (me?.assignedTo ?? [])) {
      const existing = game.clues?.[targetId]?.[memberId]
      initial[targetId] = [
        existing?.[0] ?? null,
        existing?.[1] ?? null,
        existing?.[2] ?? null,
      ]
    }
    setSlots(initial)
  }, [game, memberId])

  if (loading) return <LoadingSpinner />

  if (!game || !memberId || !me) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">👋</p>
          <h2 className="font-lora text-2xl font-bold mb-2">Not joined yet</h2>
          <p className="text-[#888] text-sm mb-6">You need to join the game first</p>
          <button onClick={() => navigate(`/join/${code}`)} className="py-3 px-8 bg-accent text-white font-semibold rounded-pill hover:bg-[#d44d23]">
            Join game
          </button>
        </div>
      </div>
    )
  }

  if (game.meta.phase !== 'clue-submission') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="font-lora text-2xl font-bold mb-2">Submissions closed</h2>
          <p className="text-[#888] text-sm">The quiz has already started!</p>
        </div>
      </div>
    )
  }

  function handleUploaded(targetId: string, slotIndex: 0 | 1 | 2, url: string) {
    setSlots(prev => ({
      ...prev,
      [targetId]: prev[targetId]?.map((v, i) => i === slotIndex ? url : v) ?? [null, null, null],
    }))
    // Optimistic write to RTDB
    update(dbRef(db, `games/${code}/clues/${targetId}/${memberId}`), {
      [slotIndex]: url,
      submittedAt: Date.now(),
    })
  }

  const totalSlots = assignedTo.length * 3
  const filledSlots = Object.values(slots).flat().filter(Boolean).length
  const isFullySubmitted = filledSlots === totalSlots

  return (
    <div className="min-h-screen bg-cream px-6 py-10">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-white border border-[#E8E0D4] rounded-pill px-4 py-2 mb-4">
            <span className="text-xs text-[#888] uppercase tracking-wider font-semibold">Game</span>
            <span className="font-lora text-base font-bold tracking-widest text-accent">{code}</span>
          </div>
          <h1 className="font-lora text-2xl font-bold text-[#1a1a1a] mb-1">Your clues</h1>
          <p className="text-[#888] text-sm">Upload 3 images per person. The better your clues, the more points you earn.</p>
        </div>

        {/* Uniqueness reminder */}
        <div className="bg-[#FFF8F5] border border-[#FFD5C8] rounded-card p-4 mb-8">
          <p className="text-sm text-[#E8572A] font-medium leading-relaxed">
            💡 Heads up: if your clues are too similar to another player's for the same person, you'll lose points. The more unique and specific, the better.
          </p>
        </div>

        {/* One section per assigned target */}
        {assignedTo.map((targetId) => {
          const target = game.members[targetId]
          if (!target) return null
          const targetSlots = slots[targetId] ?? [null, null, null]
          const filled = targetSlots.filter(Boolean).length

          return (
            <div key={targetId} className="bg-white border border-[#E8E0D4] rounded-card p-5 mb-5">
              <div className="flex items-center justify-between mb-5">
                <MemberAvatar name={target.name} photo={target.photo} size="md" />
                <span className="text-sm text-[#888] font-medium">{filled}/3 uploaded</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {([0, 1, 2] as const).map((slotIndex) => (
                  <ImageUploadSlot
                    key={slotIndex}
                    gameCode={code}
                    targetId={targetId}
                    giverId={memberId}
                    slotIndex={slotIndex}
                    currentUrl={targetSlots[slotIndex]}
                    onUploaded={(url) => handleUploaded(targetId, slotIndex, url)}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* Progress + done */}
        <div className="mt-4 text-center">
          <div className="text-sm text-[#888] mb-3">{filledSlots} / {totalSlots} clues uploaded</div>
          {isFullySubmitted && (
            <div className="inline-flex items-center gap-2 bg-[#E8F5E9] text-[#2E7D32] rounded-pill px-5 py-2.5 text-sm font-semibold">
              ✓ All clues submitted — you're done!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
