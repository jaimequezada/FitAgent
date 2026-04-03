import { motion } from 'framer-motion'

export default function AgentBubble({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        maxWidth: '72%',
        padding: '12px 16px',
        borderRadius: 18,
        borderBottomLeftRadius: 4,
        fontSize: 14,
        lineHeight: 1.6,
        fontWeight: 300,
        background: '#0c1a08',
        border: '1px solid #1e3015',
        color: 'var(--text-secondary)',
        alignSelf: 'flex-start',
      }}
    >
      {children}
    </motion.div>
  )
}
