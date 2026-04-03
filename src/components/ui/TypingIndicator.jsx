export default function TypingIndicator() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '12px 16px',
      background: '#0c1a08',
      border: '1px solid #1e3015',
      borderRadius: 18,
      borderBottomLeftRadius: 4,
      alignSelf: 'flex-start',
      width: 56,
    }}>
      {[0, 0.15, 0.3].map((delay, i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#39FF14',
            animation: `typingBounce 1.2s ease-in-out infinite ${delay}s`,
          }}
        />
      ))}
    </div>
  )
}
