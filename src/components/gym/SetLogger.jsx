// SetLogger.jsx
// Tap-to-log rep input for gym mode.
// Renders pre-populated rep count buttons: targetReps ± 3.
// Target rep count is highlighted. Number input for anything else.

export default function SetLogger({ targetReps, onLog }) {
  const min     = Math.max(1, targetReps - 3)
  const options = Array.from({ length: 6 }, (_, i) => min + i)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-6 gap-2">
        {options.map(rep => (
          <button
            key={rep}
            onClick={() => onLog(rep)}
            className="aspect-square flex items-center justify-center rounded-xl text-sm font-semibold transition-colors"
            style={rep === targetReps ? {
              background: 'rgba(57,255,20,0.12)',
              border: '1px solid rgba(57,255,20,0.4)',
              color: 'var(--accent-green)',
            } : {
              background: '#161616',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-secondary)',
            }}
          >
            {rep}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-[var(--text-secondary)] text-center">Tap your reps. That's it.</p>
    </div>
  )
}
