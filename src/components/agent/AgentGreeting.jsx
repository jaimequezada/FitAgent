// AgentGreeting.jsx
// Context-aware greeting line at the top of Home mode.
// Shown as subtle plain text above the chat thread — not a bubble.
// greeting=null shows a placeholder shimmer while loading.

export default function AgentGreeting({ greeting }) {
  if (greeting === null) {
    return (
      <div className="h-5 w-48 rounded bg-[var(--bg-elevated)] animate-pulse" />
    )
  }

  return (
    <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
      {greeting}
    </p>
  )
}
