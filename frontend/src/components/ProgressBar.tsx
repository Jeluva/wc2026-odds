interface Props {
  label: string
  value: number
  max?: number
  color?: string
}

export function ProgressBar({ label, value, max = 100, color = 'bg-accent' }: Props) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">{label}</span>
        <span className="text-xs font-semibold text-ink">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-subtle rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
