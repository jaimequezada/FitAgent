// PRCard.jsx
// Displays a single personal record.
// Compact, subtle — data-forward, no celebration.
// trend: 'up' = PR set within last 4 weeks, null = older

export default function PRCard({ lift, weight, date, trend }) {
  const isRecent = trend === 'up'

  // Format date as relative (e.g. "3 weeks ago") or absolute for older
  function formatDate(dateStr) {
    if (!dateStr) return ''
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 7)  return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    if (days < 365) return `${Math.floor(days / 30)}mo ago`
    return `${Math.floor(days / 365)}y ago`
  }

  return (
    <div className="flex flex-col gap-1 px-4 py-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] min-w-0">
      <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest truncate">
        {lift}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tabular-nums text-[var(--text-primary)] leading-none">
          {weight}
        </span>
        <span className="text-xs text-[var(--text-secondary)]">lbs</span>
        {isRecent && (
          <span className="ml-auto text-xs text-[var(--text-secondary)]">↑</span>
        )}
      </div>
      {date && (
        <span className="text-[10px] text-[var(--text-secondary)]">{formatDate(date)}</span>
      )}
    </div>
  )
}
