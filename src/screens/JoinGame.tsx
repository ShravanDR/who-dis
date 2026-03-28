import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useGame } from '../hooks/useGame'
import { useLocalPlayer } from '../hooks/useLocalPlayer'

export default function JoinGame() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { game, loading, error: gameError } = useGame(code)
  const { setGameCode, setMemberId } = useLocalPlayer()

  const [selectedId, setSelectedId] = useState('')
  const [joining, setJoining] = useState(false)

  const members = game?.members ? Object.entries(game.members) : []

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    setJoining(true)
    setGameCode(code)
    setMemberId(selectedId)

    const phase = game?.meta.phase
    if (phase === 'clue-submission') {
      navigate(`/submit/${code}`)
    } else if (phase === 'quiz' || phase === 'finished') {
      navigate(`/quiz/${code}`)
    } else {
      navigate(`/submit/${code}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (gameError || !game) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">🤔</p>
          <h2 className="font-lora text-2xl font-bold mb-2">Game not found</h2>
          <p className="text-[#888] text-sm mb-6">Check your code and try again</p>
          <button onClick={() => navigate('/')} className="py-3 px-8 bg-accent text-white font-semibold rounded-pill hover:bg-[#d44d23] transition-colors">
            Back to home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white border border-[#E8E0D4] rounded-pill px-4 py-2 mb-4">
            <span className="text-xs text-[#888] uppercase tracking-wider font-semibold">Game</span>
            <span className="font-lora text-lg font-bold tracking-widest text-accent">{code}</span>
          </div>
          <h2 className="font-lora text-2xl font-bold text-[#1a1a1a]">Who are you?</h2>
          <p className="text-[#888] text-sm mt-1">Select your name from the list below</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-3">
          <div className="bg-white border border-[#E8E0D4] rounded-card overflow-hidden">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full h-14 px-5 text-sm font-medium text-[#1a1a1a] bg-white outline-none appearance-none cursor-pointer"
            >
              <option value="">Choose your name…</option>
              {members.map(([id, member]) => (
                <option key={id} value={id}>{member.name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={!selectedId || joining}
            className="w-full py-4 bg-accent text-white font-semibold rounded-pill disabled:opacity-40 hover:bg-[#d44d23] transition-colors"
          >
            {joining ? 'Entering…' : "Let's go →"}
          </button>
        </form>
      </div>
    </div>
  )
}
