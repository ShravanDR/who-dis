import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { useGame } from '../hooks/useGame'
import { useLocalPlayer } from '../hooks/useLocalPlayer'
import OrbitalLoader from '../components/OrbitalLoader'

export default function SubmissionMonitor() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { game, loading } = useGame(code)
  const { hostSecret } = useLocalPlayer()

  const [revealInterval, setRevealInterval] = useState(12)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isHost = !!hostSecret
  const members = game?.members ? Object.entries(game.members) : []

  function submittedCount(memberId: string) {
    const member = game?.members[memberId]
    if (!member || !game?.clues) return 0
    let total = 0
    for (const targetId of member.assignedTo) {
      const clue = game.clues[targetId]?.[memberId]
      if (!clue) continue
      for (const i of [0, 1, 2] as const) {
        if (clue[i]) total++
      }
    }
    return total
  }

  function fullySubmitted(memberId: string) {
    return submittedCount(memberId) === 6
  }

  const submittedPlayers = members.filter(([id]) => fullySubmitted(id)).length

  async function handleStartQuiz() {
    if (!hostSecret) return
    setStarting(true)
    setError(null)
    try {
      const startQuiz = httpsCallable<
        { gameCode: string; hostSecret: string; revealIntervalSeconds: number },
        { success: boolean }
      >(functions, 'startQuiz')
      await startQuiz({ gameCode: code, hostSecret, revealIntervalSeconds: revealInterval })
      navigate(`/quiz/${code}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start quiz')
      setStarting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <OrbitalLoader size={80} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream px-6 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-[#E8E0D4] rounded-pill px-4 py-1.5 mb-2">
              <span className="text-xs text-[#888] uppercase tracking-wider font-semibold">Game</span>
              <span className="font-lora text-base font-bold tracking-widest text-accent">{code}</span>
            </div>
            <h1 className="font-lora text-2xl font-bold text-[#1a1a1a]">Submission monitor</h1>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[#1a1a1a]">{submittedPlayers}<span className="text-lg text-[#888]">/{members.length}</span></div>
            <div className="text-xs text-[#888]">submitted</div>
          </div>
        </div>

        {/* Member grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {members.map(([id, member]) => {
            const count = submittedCount(id)
            const done = count === 6
            return (
              <div
                key={id}
                className={`bg-white border rounded-card p-4 transition-colors
                  ${done ? 'border-[#A5D6A7]' : 'border-[#E8E0D4]'}`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#F0ECE4] flex items-center justify-center text-base overflow-hidden flex-shrink-0">
                    {member.photo.startsWith('http') ? (
                      <img src={member.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{member.photo}</span>
                    )}
                  </div>
                  <span className="text-sm font-medium truncate">{member.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-1.5 flex-1 rounded-full bg-[#E8E0D4] overflow-hidden mr-3">
                    <div
                      className={`h-full rounded-full transition-all ${done ? 'bg-[#4CAF50]' : 'bg-accent'}`}
                      style={{ width: `${(count / 6) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold ${done ? 'text-[#2E7D32]' : 'text-[#888]'}`}>
                    {done ? '✓' : `${count}/6`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Host controls */}
        {isHost && (
          <div className="bg-white border border-[#E8E0D4] rounded-card p-5">
            <p className="text-sm font-semibold mb-4">Host controls</p>

            {/* Reveal interval */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-medium">Seconds between clues</p>
                <p className="text-xs text-[#888]">8–20 seconds (default 12)</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRevealInterval(v => Math.max(8, v - 1))}
                  className="w-8 h-8 rounded-full border border-[#E8E0D4] flex items-center justify-center text-lg hover:bg-[#F8F5F0] transition-colors"
                >
                  −
                </button>
                <span className="w-8 text-center font-bold text-lg">{revealInterval}</span>
                <button
                  onClick={() => setRevealInterval(v => Math.min(20, v + 1))}
                  className="w-8 h-8 rounded-full border border-[#E8E0D4] flex items-center justify-center text-lg hover:bg-[#F8F5F0] transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-danger mb-3">{error}</p>}

            {submittedPlayers < members.length && (
              <p className="text-xs text-[#888] mb-3">
                {members.length - submittedPlayers} player{members.length - submittedPlayers !== 1 ? 's' : ''} haven't submitted yet — you can still start.
              </p>
            )}

            <button
              onClick={handleStartQuiz}
              disabled={starting || members.length < 3}
              className="w-full py-4 bg-accent text-white font-semibold rounded-pill disabled:opacity-40 hover:bg-[#d44d23] transition-colors"
            >
              {starting ? 'Starting…' : 'Start quiz →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
