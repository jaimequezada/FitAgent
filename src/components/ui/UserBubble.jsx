import { motion } from 'framer-motion'

export default function UserBubble({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        maxWidth: '72%',
        padding: '12px 16px',
        borderRadius: 18,
        borderBottomRightRadius: 4,
        fontSize: 14,
        lineHeight: 1.6,
        fontWeight: 300,
        background: 'var(--surface2)',
        border: '1px solid var(--border2)',
        color: 'var(--text-secondary)',
        alignSelf: 'flex-end',
      }}
    >
      {children}
    </motion.div>
  )
}
