// TrainingBalanceSection.jsx
// Three-card row showing dynamic training balance analysis.
// balance: null = loading, Category[] = loaded, [] = failed/hide
// Category: { label, status, metric, suggestion, color }

function Shimmer({ className }) {
  return <div className={`rounded bg-[var(--bg-elevated)] animate-pulse ${className}`} />
}

const COLOR_MAP = {
  green:  'var(--accent-green)',
  yellow: '#f5c518',
  white:  'var(--text-primary)',
}

function BalanceCard({ category }) {
  const isLoading  = category === null
  const isBaseline = category?.status === 'Building baseline'
  const color      = COLOR_MAP[category?.color] ?? 'var(--text-secondary)'

  return (
    <div
      className="flex-1 rounded-2xl px-4 py-4 flex flex-col gap-2 min-w-0"
      style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <p className="text-[9px] tracking-[0.22em] text-[var(--text-secondary)] uppercase">
        {isLoading ? <Shimmer className="h-2 w-8" /> : category.label}
      </p>

      {isLoading ? (
        <div className="flex flex-col gap-2 mt-1">
          <Shimmer className="h-2.5 w-full" />
          <Shimmer className="h-2.5 w-4/5" />
          <Shimmer className="h-2.5 w-3/5" />
        </div>
      ) : isBaseline ? (
        <>
          <p className="text-xs font-medium text-[var(--text-primary)]">Building baseline</p>
          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            Check back after a few more sessions
          </p>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold" style={{ color }}>{category.status}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">{category.metric}</p>
          <p className="text-xs text-[var(--text-primary)] leading-snug">{category.suggestion}</p>
        </>
      )}
    </div>
  )
}

// Placeholder cards while loading — 3 nulls render shimmer state
const LOADING_PLACEHOLDERS = [null, null, null]

export default function TrainingBalanceSection({ balance }) {
  const categories = balance === null ? LOADING_PLACEHOLDERS : (balance ?? [])

  if (balance !== null && categories.length === 0) return null

  return (
    <div>
      <p className="text-[9px] tracking-[0.22em] text-[var(--text-secondary)] uppercase mb-3">
        Training Balance
      </p>
      <div className="flex gap-2">
        {categories.map((cat, i) => (
          <BalanceCard key={cat?.label ?? i} category={cat} />
        ))}
      </div>
    </div>
  )
}
