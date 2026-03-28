// Plan 2 placeholder — Quiz engine implemented in who-dis-plan-2
import { useParams } from 'react-router-dom'
import { useGame } from '../hooks/useGame'

export default function Quiz() {
  const { code = '' } = useParams<{ code: string }>()
  const { game, loading } = useGame(code)

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-5xl mb-4">🎮</p>
        <h2 className="font-lora text-3xl font-bold text-[#1a1a1a] mb-2">Quiz starting…</h2>
        <p className="text-[#888]">
          Phase: <strong>{game?.meta.phase}</strong>
        </p>
        <p className="text-xs text-[#C4B9A8] mt-4">Quiz engine (Plan 2) coming soon</p>
      </div>
    </div>
  )
}
