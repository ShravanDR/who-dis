interface ProgressBarProps {
  current: number
  total: number
  label?: string
}

export default function ProgressBar({ current, total, label }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div>
      {label && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm text-[#888]">{label}</span>
          <span className="text-sm font-semibold text-[#1a1a1a]">{current} / {total}</span>
        </div>
      )}
      <div className="h-2 rounded-full bg-[#E8E0D4] overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
