import { motion } from 'framer-motion'

export default function PulsingOrb({ size = 24, borderRadius = 8 }) {
  const dotSize = size * 0.36
  const ringSize = size * 0.8

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius,
      background: '#111f0a',
      border: '1px solid #1e3015',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <div style={{ position: 'relative', width: size * 0.5, height: size * 0.5 }}>
        {/* Inner dot */}
        <motion.div
          animate={{ opacity: [1, 0.3, 1], scale: [1, 0.75, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: '#39FF14',
          }} />
        </motion.div>
        {/* Outer ring */}
        <motion.div
          animate={{ opacity: [0.3, 0.1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{
            width: ringSize,
            height: ringSize,
            borderRadius: '50%',
            border: '1px solid #39FF14',
            background: 'transparent',
          }} />
        </motion.div>
      </div>
    </div>
  )
}
