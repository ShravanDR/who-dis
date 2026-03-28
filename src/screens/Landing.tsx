import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

export default function Landing() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length === 6) navigate(`/join/${trimmed}`)
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-12 text-center">
        <h1 className="font-lora text-5xl font-bold text-[#1a1a1a] tracking-tight mb-3">
          Who Dis?
        </h1>
        <p className="text-[#888] text-lg">
          The visual guessing game for teams
        </p>
      </div>

      {/* Cards */}
      <div className="w-full max-w-sm space-y-4">
        {/* Join */}
        {!joining ? (
          <button
            onClick={() => setJoining(true)}
            className="w-full py-4 px-6 bg-accent text-white font-semibold text-base rounded-pill hover:bg-[#d44d23] transition-colors"
          >
            Join a game
          </button>
        ) : (
          <form onSubmit={handleJoin} className="bg-white border border-[#E8E0D4] rounded-card p-5 space-y-3">
            <p className="text-sm font-semibold text-[#1a1a1a]">Enter your game code</p>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="XXXXXX"
              className="w-full h-12 border border-[#E8E0D4] rounded-pill px-5 text-center text-lg font-bold tracking-widest outline-none focus:border-accent transition-colors font-jakarta"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setJoining(false); setCode('') }}
                className="flex-1 py-3 border border-[#E8E0D4] text-[#888] text-sm font-semibold rounded-pill hover:bg-[#F8F5F0] transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={code.trim().length !== 6}
                className="flex-1 py-3 bg-accent text-white text-sm font-semibold rounded-pill disabled:opacity-40 hover:bg-[#d44d23] transition-colors"
              >
                Enter →
              </button>
            </div>
          </form>
        )}

        {/* Host */}
        <button
          onClick={() => navigate('/setup')}
          className="w-full py-4 px-6 bg-white border border-[#E8E0D4] text-[#1a1a1a] font-semibold text-base rounded-pill hover:bg-[#F8F5F0] transition-colors"
        >
          Host a game
        </button>
      </div>

      <p className="mt-12 text-xs text-[#C4B9A8] text-center">
        Monthly team game · 6–20 players
      </p>
    </div>
  )
}
