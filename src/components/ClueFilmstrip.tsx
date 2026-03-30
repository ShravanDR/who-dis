import { useCountdown } from '../hooks/useCountdown'

interface Props {
  clueUrls: string[]
  availableCount: number
  currentIndex: number
  timerPaused: boolean
  intervalSeconds: number
}

export default function ClueFilmstrip({ clueUrls, availableCount, currentIndex, timerPaused, intervalSeconds }: Props) {
  const remaining = useCountdown(intervalSeconds, timerPaused || currentIndex < 0, currentIndex)
  const slots = Array.from({ length: availableCount }, (_, i) => clueUrls[i] ?? null)

  return (
    <div>
      {/* Timer bar */}
      {currentIndex >= 0 && currentIndex < availableCount && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#888]">Clue {currentIndex + 1} of {availableCount}</span>
            <span className={`text-sm font-bold ${remaining <= 3 ? 'text-danger' : 'text-[#1a1a1a]'}`}>
              {remaining}s
            </span>
          </div>
          <div className="h-1 rounded-full bg-[#E8E0D4] overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-1000 ease-linear"
              style={{ width: `${(remaining / intervalSeconds) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Filmstrip */}
      <div className="flex gap-2">
        {slots.map((url, i) => {
          const isRevealed = i <= currentIndex
          const isActive = i === currentIndex
          const isLocked = i > currentIndex

          return (
            <div
              key={i}
              className={`flex-1 aspect-[3/4] rounded-xl overflow-hidden relative transition-all duration-500 ${
                isActive
                  ? 'ring-2 ring-accent ring-offset-2 ring-offset-cream shadow-lg scale-[1.03]'
                  : isRevealed
                  ? 'opacity-60'
                  : 'bg-[#F0ECE4]'
              }`}
            >
              {isRevealed && url ? (
                <img src={url} alt={`Clue ${i + 1}`} className="w-full h-full object-cover" />
              ) : isLocked ? (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-xl text-[#C4B9A8]">?</span>
                </div>
              ) : null}

              {/* Slot number badge */}
              <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                isActive ? 'bg-accent text-white' : isRevealed ? 'bg-black/30 text-white' : 'bg-[#E8E0D4] text-[#888]'
              }`}>
                {i + 1}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
