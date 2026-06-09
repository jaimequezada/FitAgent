import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import PulsingOrb from '../ui/PulsingOrb'
import { useAuth } from '../../hooks/useAuth'

// ─── Typing animation hook ────────────────────────────────────────────────────
const TYPING_MESSAGES = [
  "You've been stuck on bench for 3 weeks. The bottleneck is <strong>tricep strength</strong>. Here's what I'd change this week.",
  "Your pressing strength is solid. Try adding <strong>5 lb to bench</strong> today — your volume trend supports it.",
  "Nice consistency. You've hit push day <strong>3 weeks straight</strong>. Recovery looks good. Let's push it.",
]

function useTypingAnimation() {
  const [html, setHtml] = useState('')
  const stateRef = useRef({ msgIndex: 0, charIndex: 0, isDeleting: false, timer: null })

  useEffect(() => {
    const s = stateRef.current

    function stripHtml(str) {
      return str.replace(/<[^>]+>/g, '')
    }

    function buildDisplay(raw, upTo) {
      let count = 0, display = '', i = 0
      while (i < raw.length && count < upTo) {
        if (raw[i] === '<') {
          const close = raw.indexOf('>', i)
          display += raw.slice(i, close + 1)
          i = close + 1
        } else {
          display += raw[i]; count++; i++
        }
      }
      return display
    }

    function tick() {
      const raw = TYPING_MESSAGES[s.msgIndex]
      const stripped = stripHtml(raw)

      if (!s.isDeleting) {
        s.charIndex++
        setHtml(buildDisplay(raw, s.charIndex))
        if (s.charIndex >= stripped.length) {
          s.timer = setTimeout(() => { s.isDeleting = true; tick() }, 2800)
          return
        }
        s.timer = setTimeout(tick, 28)
      } else {
        s.charIndex--
        if (s.charIndex <= 0) {
          s.isDeleting = false
          s.msgIndex = (s.msgIndex + 1) % TYPING_MESSAGES.length
          s.timer = setTimeout(tick, 400)
          return
        }
        setHtml(buildDisplay(TYPING_MESSAGES[s.msgIndex], s.charIndex))
        s.timer = setTimeout(tick, 14)
      }
    }

    s.timer = setTimeout(tick, 1200)
    return () => clearTimeout(s.timer)
  }, [])

  return html
}

// ─── Animated chat for feature card 3 ────────────────────────────────────────
const CHAT_LOOP = [
  { role: 'user', text: "Why is my bench stalling?" },
  { role: 'agent', text: "Your triceps are the limiting factor. Add <strong>close-grip bench</strong> as your third press — two sets, same rep range." },
  { role: 'user', text: "How much protein do I need?" },
  { role: 'agent', text: "At your weight, aim for <strong>175–190g per day</strong>. You've been averaging 140g — that's slowing your recovery." },
  { role: 'user', text: "Should I train if I'm sore?" },
  { role: 'agent', text: "Depends where. Your legs are 3 days out — <strong>upper body today is fine</strong>. Save legs for Thursday." },
  { role: 'user', text: "Is my program balanced?" },
  { role: 'agent', text: "Mostly. Push volume is solid but <strong>pulling is under-programmed</strong> — add a row on Wednesday." },
]

function AnimatedChat() {
  const [bubbles, setBubbles] = useState([])
  const indexRef = useRef(0)
  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    let t
    function next() {
      if (indexRef.current >= CHAT_LOOP.length) {
        t = setTimeout(() => {
          setBubbles([])
          setOffset(0)
          indexRef.current = 0
          t = setTimeout(next, 400)
        }, 2200)
        return
      }
      const msg = CHAT_LOOP[indexRef.current]
      setBubbles(prev => [...prev, msg])
      indexRef.current++
      t = setTimeout(next, 1400)
    }
    t = setTimeout(next, 600)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (outerRef.current && innerRef.current) {
      const overflow = innerRef.current.scrollHeight - outerRef.current.clientHeight
      setOffset(overflow > 0 ? overflow : 0)
    }
  }, [bubbles])

  return (
    <div ref={outerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      <div
        ref={innerRef}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 20,
          transform: `translateY(-${offset}px)`,
          transition: 'transform 0.5s ease',
        }}
      >
        <AnimatePresence>
          {bubbles.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{
                padding: '10px 14px',
                borderRadius: 14,
                borderBottomLeftRadius: msg.role === 'agent' ? 4 : 14,
                borderBottomRightRadius: msg.role === 'user' ? 4 : 14,
                fontSize: 12,
                lineHeight: 1.55,
                maxWidth: '85%',
                fontWeight: 300,
                flexShrink: 0,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'agent' ? '#111f0a' : 'var(--surface2)',
                border: msg.role === 'agent' ? '1px solid #1e3015' : '1px solid var(--border2)',
                color: 'var(--text-secondary)',
              }}
              dangerouslySetInnerHTML={{ __html: msg.text }}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Scroll reveal wrapper ────────────────────────────────────────────────────
function Reveal({ children }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

// ─── Small agent orb for mockup headers ──────────────────────────────────────
function MockupOrbHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexShrink: 0 }}>
      <div style={{ width: 22, height: 22, borderRadius: 7, background: '#111f0a', border: '1px solid #1e3015', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <PulsingOrb size={16} borderRadius={5} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>FITAGENT</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const typingHtml = useTypingAnimation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: 'var(--bg)', color: 'var(--text-primary)', overflowX: 'hidden' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 60, boxSizing: 'border-box',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        backdropFilter: 'none',
      }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-primary)', textDecoration: 'none' }}>
          <PulsingOrb size={24} />
          FITAGENT
        </a>
        <ul style={{ display: 'flex', alignItems: 'center', gap: 36, listStyle: 'none', margin: 0 }} className="landing-nav-links">
          {[['#how', 'How it works'], ['#features', 'Features'], ['#pricing', 'Pricing']].map(([href, label]) => (
            <li key={href}>
              <a href={href} style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', letterSpacing: '0.04em', transition: 'color 0.2s' }}
                onMouseEnter={e => e.target.style.color = 'var(--text-secondary)'}
                onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
              >{label}</a>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }} className="landing-nav-actions">
          {user ? (
            <Link to="/home" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, background: 'var(--green)', color: '#000', border: 'none', borderRadius: 100, padding: '10px 20px', cursor: 'pointer', textDecoration: 'none' }}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/signin" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Sign in</Link>
              <Link to="/signup" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, background: 'var(--green)', color: '#000', border: 'none', borderRadius: 100, padding: '10px 20px', cursor: 'pointer', textDecoration: 'none' }}>
                Start for free
              </Link>
            </>
          )}
        </div>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="landing-hamburger"
          style={{ display: 'none', flexDirection: 'column', gap: 5, cursor: 'pointer', padding: 4, background: 'none', border: 'none' }}
          aria-label="Menu"
        >
          <span style={{ display: 'block', width: 22, height: 1.5, background: 'var(--text-secondary)', borderRadius: 2, transition: 'transform 0.3s, opacity 0.3s', transform: menuOpen ? 'translateY(6.5px) rotate(45deg)' : 'none' }} />
          <span style={{ display: 'block', width: 22, height: 1.5, background: 'var(--text-secondary)', borderRadius: 2, opacity: menuOpen ? 0 : 1, transition: 'opacity 0.3s' }} />
          <span style={{ display: 'block', width: 22, height: 1.5, background: 'var(--text-secondary)', borderRadius: 2, transition: 'transform 0.3s', transform: menuOpen ? 'translateY(-6.5px) rotate(-45deg)' : 'none' }} />
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99,
              background: 'rgba(12,12,12,0.97)', backdropFilter: 'blur(16px)',
              borderBottom: '1px solid var(--border)', padding: 24,
              display: 'flex', flexDirection: 'column',
            }}
          >
            {[['#how', 'How it works'], ['#features', 'Features'], ['#pricing', 'Pricing'], ...(user ? [] : [['/signin', 'Sign in']])].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} style={{ fontSize: 16, color: 'var(--text-secondary)', textDecoration: 'none', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                {label}
              </a>
            ))}
            <Link to={user ? '/home' : '/signup'} onClick={() => setMenuOpen(false)} style={{ marginTop: 20, textAlign: 'center', background: 'var(--green)', color: '#000', fontWeight: 500, borderRadius: 100, padding: 14, textDecoration: 'none', display: 'block' }}>
              {user ? 'Go to dashboard' : 'Start for free'}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HERO ── */}
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(57,255,20,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 100, padding: '6px 14px', marginBottom: 48 }}
        >
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s ease-in-out infinite' }} />
          AI-POWERED COACH
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7 }}
          style={{ fontSize: 'clamp(52px, 8vw, 96px)', fontWeight: 300, lineHeight: 1.05, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 24 }}
        >
          Your coach.<br /><span style={{ color: 'var(--green)', fontStyle: 'normal' }}>Always learning.</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.7 }}
          style={{ fontSize: 17, fontWeight: 300, color: 'var(--text-secondary)', maxWidth: 380, lineHeight: 1.65, marginBottom: 48 }}
        >
          Personalized programs that evolve with every session.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.7 }}
          style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 80 }}
        >
          {user ? (
            <Link to="/home" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, background: 'var(--green)', color: '#000', border: 'none', borderRadius: 100, padding: '13px 28px', cursor: 'pointer', textDecoration: 'none' }}>
              Go to your dashboard →
            </Link>
          ) : (
            <>
              <Link to="/signup" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, background: 'var(--green)', color: '#000', border: 'none', borderRadius: 100, padding: '13px 28px', cursor: 'pointer', textDecoration: 'none' }}>
                Start free — no credit card
              </Link>
              <Link to="/signin" style={{ fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none' }}>Sign in →</Link>
            </>
          )}
        </motion.div>

        {/* Hero AI card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.8 }}
          className="landing-hero-card" style={{ width: 340, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, textAlign: 'left', position: 'relative' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <PulsingOrb size={28} borderRadius={9} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>FITAGENT</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, fontWeight: 300, minHeight: 88 }}
            dangerouslySetInnerHTML={{ __html: typingHtml + '<span style="display:inline-block;width:2px;height:14px;background:#39FF14;margin-left:2px;vertical-align:middle;animation:blink 1s step-end infinite;"></span>' }}
          />
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#555" strokeWidth="1.2">
                <polyline points="1,8 4,4 7,6 11,2"/>
              </svg>
              Bench press <span style={{ color: 'var(--green)', fontWeight: 500, marginLeft: 4 }}>+15 lb</span>&nbsp;in 6 weeks
            </div>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.6 }}
          style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
        >
          <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, transparent, var(--border2))', animation: 'scrollPulse 2s ease-in-out infinite' }} />
        </motion.div>
      </div>

      {/* ── PROBLEM ── */}
      <div className="landing-section" style={{ width: '100%', padding: '0 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 0' }}>
          <Reveal>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 16 }}>THE PROBLEM</p>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)', marginBottom: 64 }}>
              Most apps track.<br /><span style={{ color: 'var(--text-secondary)' }}>None of them think.</span>
            </h2>
            <div className="landing-problem-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
              {[
                ['01', 'You log the same exercises week after week.', "No app has ever told you why that's a problem."],
                ['02', "You're not sure if your program is working.", "You're making changes based on feel, not data."],
                ['03', "You're guessing at progressive overload.", "Most apps record numbers. None tell you what to do with them."],
                ['04', 'A real coach costs $150 a session.', "And they're not available at 10pm when you're planning tomorrow's workout."],
              ].map(([num, title, desc]) => (
                <div key={num} style={{ background: 'var(--surface)', padding: 36, transition: 'background 0.2s', cursor: 'default' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                >
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 14 }}>{num}</p>
                  <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.4 }}>{title}</p>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.6 }}>{desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div className="landing-section" style={{ width: '100%', padding: '0 48px' }} id="features">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 0' }}>
          <Reveal>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 16 }}>FEATURES</p>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)', marginBottom: 64 }}>
              Three ways it shows up for you.
            </h2>
            <div className="landing-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'stretch' }}>

              {/* Card 1: Remembers everything */}
              <motion.div whileHover={{ y: -3, borderColor: 'var(--border2)' }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="landing-feature-mockup" style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', height: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <MockupOrbHeader />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ padding: '10px 14px', borderRadius: 14, borderBottomRightRadius: 4, fontSize: 12, lineHeight: 1.55, maxWidth: '85%', fontWeight: 300, alignSelf: 'flex-end', background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text-secondary)' }}>
                      How has my squat been trending?
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: 14, borderBottomLeftRadius: 4, fontSize: 12, lineHeight: 1.55, fontWeight: 300, background: '#111f0a', border: '1px solid #1e3015', color: 'var(--text-secondary)' }}>
                      Up <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>+30 lb over 8 weeks</strong>. Your best session was last Thursday — 255 × 5. Consistent week over week.
                      <div style={{ marginTop: 10, background: '#0c1a08', borderRadius: 10, padding: '10px 12px' }}>
                        <p style={{ fontSize: 9, letterSpacing: '0.07em', color: '#3a5c30', marginBottom: 8 }}>SQUAT — 8 WEEKS</p>
                        <svg width="100%" height="64" viewBox="0 0 240 64" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="sqFade" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#39FF14" stopOpacity="0.15" />
                              <stop offset="100%" stopColor="#39FF14" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d="M10,54 L44,48 L78,40 L112,32 L146,24 L180,16 L214,10 L230,6 L230,64 L10,64 Z" fill="url(#sqFade)" />
                          <polyline points="10,54 44,48 78,40 112,32 146,24 180,16 214,10 230,6" fill="none" stroke="#39FF14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="230" cy="6" r="4" fill="#39FF14" />
                        </svg>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 9, color: '#3a5c30' }}>Wk1 · 225</span>
                          <span style={{ fontSize: 9, color: '#39FF14', fontWeight: 500 }}>Wk8 · 255</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '20px 24px 24px' }}>
                  <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>REMEMBERS EVERYTHING</p>
                  <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Your history, in full.</p>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.65 }}>Goals, PRs, injuries, what worked — your coach holds it all across every session.</p>
                </div>
              </motion.div>

              {/* Card 2: Adapts program */}
              <motion.div whileHover={{ y: -3, borderColor: 'var(--border2)' }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="landing-feature-mockup" style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', height: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <MockupOrbHeader />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ padding: '10px 14px', borderRadius: 14, borderBottomRightRadius: 4, fontSize: 12, lineHeight: 1.55, maxWidth: '85%', fontWeight: 300, alignSelf: 'flex-end', background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text-secondary)' }}>
                      Anything I should change this week?
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: 14, borderBottomLeftRadius: 4, fontSize: 12, lineHeight: 1.55, fontWeight: 300, background: '#111f0a', border: '1px solid #1e3015', color: 'var(--text-secondary)' }}>
                      You've hit every rep target 3 weeks straight. Time to progress — I've updated your plan.
                      <div style={{ marginTop: 10, background: '#0c0c0c', border: '1px solid #222', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a' }}>
                          <p style={{ fontSize: 9, letterSpacing: '0.07em', color: '#555', marginBottom: 8 }}>THIS WEEK'S UPDATES</p>
                          {[['Bench Press', '135 lb', '140 lb'], ['Squat', '225 lb', '235 lb'], ['OHP', '95 lb', null]].map(([name, old_, new_]) => (
                            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                              <span style={{ fontSize: 11, color: '#aaa' }}>{name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: '#555', textDecoration: new_ ? 'line-through' : 'none' }}>{old_}</span>
                                {new_
                                  ? <span style={{ fontSize: 11, color: '#39FF14', fontWeight: 500 }}>{new_}</span>
                                  : <span style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>hold</span>
                                }
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ padding: '8px 12px' }}>
                          <p style={{ fontSize: 11, color: '#555', fontWeight: 300 }}>OHP stays — your lockout is still catching up.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '20px 24px 24px' }}>
                  <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>ADAPTS YOUR PROGRAM</p>
                  <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>No two weeks the same.</p>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.65 }}>Your plan evolves based on your performance. Not a preset. Never stale.</p>
                </div>
              </motion.div>

              {/* Card 3: Animated chat */}
              <motion.div whileHover={{ y: -3, borderColor: 'var(--border2)' }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="landing-feature-mockup" style={{ position: 'relative', padding: '20px 20px 0', borderBottom: '1px solid var(--border)', height: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <MockupOrbHeader />
                  <div style={{ position: 'absolute', top: 44, left: 0, right: 0, height: 24, background: 'linear-gradient(to bottom, var(--surface), transparent)', zIndex: 2, pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(to top, var(--surface), transparent)', zIndex: 2, pointerEvents: 'none' }} />
                  <AnimatedChat />
                </div>
                <div style={{ padding: '20px 24px 24px' }}>
                  <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>ALWAYS COACHING</p>
                  <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Ask anything. Get answers.</p>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.65 }}>Form, recovery, nutrition — expert AI guidance in seconds, any time of day.</p>
                </div>
              </motion.div>

            </div>
          </Reveal>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div className="landing-section" style={{ width: '100%', padding: '0 48px' }} id="how">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 0' }}>
          <Reveal>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 16 }}>HOW IT WORKS</p>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)', marginBottom: 64 }}>
              Three steps.<br /><span style={{ color: 'var(--text-secondary)' }}>Then it knows you.</span>
            </h2>
            <div className="landing-hiw-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                ['1', 'Tell your coach about yourself', 'A 2 minute conversation. Your goals, your lifts, your history. No forms.'],
                ['2', 'Get your program', 'Built specifically for you. Every exercise explained, not just listed.'],
                ['3', 'It gets smarter every session', 'At the gym — just log your reps. The app already knows your plan. Ask your coach to adjust anytime — it has full context on every session.'],
              ].map(([num, title, desc]) => (
                <div key={num} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '32px 28px' }}>
                  <div style={{ fontSize: 48, fontWeight: 300, color: 'var(--green)', lineHeight: 1, marginBottom: 20, opacity: 0.7 }}>{num}</div>
                  <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>{title}</p>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.65 }}>{desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div className="landing-section" style={{ width: '100%', padding: '0 48px' }} id="pricing">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 0' }}>
          <Reveal>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 16 }}>PRICING</p>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-primary)', marginBottom: 64 }}>
              Simple.<br /><span style={{ color: 'var(--text-secondary)' }}>No surprises.</span>
            </h2>
            <div className="landing-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignItems: 'stretch', maxWidth: 720, margin: '0 auto' }}>
              {[
                { tier: 'FREE TRIAL', price: 'Free', cadenceNode: <span>7 days free</span>, items: ['Full feature access', 'Personalized workout program', 'Session logging & memory', 'No credit card required'], btnLabel: 'Start for free', btnStyle: 'ghost', featured: false },
                { tier: 'MEMBER', price: '$15', cadenceNode: <span>per month</span>, items: ['Always knows your training data', 'Training history that compounds over time', 'Guidance when you need it most', 'Just ask — your coach handles the rest'], btnLabel: 'Coming Soon', btnStyle: 'filled', featured: true },
              ].map((plan) => (
                <motion.div key={plan.tier} whileHover={{ y: -3 }}
                  style={{
                    background: plan.featured ? '#0f1a0a' : 'var(--surface)',
                    border: plan.featured ? '1px solid rgba(57,255,20,0.3)' : '1px solid var(--border)',
                    borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {plan.tier}
                    {plan.featured && (
                      <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', color: 'var(--green)', border: '1px solid rgba(57,255,20,0.3)', borderRadius: 100, padding: '3px 10px' }}>BEST VALUE</span>
                    )}
                  </div>
                  <p style={{ fontSize: 44, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 6 }}>{plan.price}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 300 }}>{plan.cadenceNode}</p>
                  <p style={{ minHeight: 18, marginBottom: 24 }}>&nbsp;</p>
                  <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
                  <ul style={{ flex: 1, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                    {plan.items.map(item => (
                      <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.4 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: plan.featured ? 'var(--green)' : 'var(--text-muted)', flexShrink: 0, marginTop: 6, display: 'inline-block' }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled={plan.btnLabel === 'Coming Soon'}
                    style={{
                      width: '100%', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
                      padding: 14, borderRadius: 12, cursor: plan.btnLabel === 'Coming Soon' ? 'not-allowed' : 'pointer', textAlign: 'center',
                      background: plan.btnStyle === 'filled' ? 'var(--green)' : 'var(--surface2)',
                      border: plan.btnStyle === 'filled' ? 'none' : '1px solid var(--border2)',
                      color: plan.btnStyle === 'filled' ? '#000' : 'var(--text-secondary)',
                      transition: 'opacity 0.2s, transform 0.2s',
                      opacity: plan.btnLabel === 'Coming Soon' ? 0.5 : 1,
                    }}
                    onClick={() => { if (plan.btnLabel === 'Start for free') window.location.href = user ? '/home' : '/signup' }}
                    onMouseEnter={e => { if (plan.btnLabel !== 'Coming Soon') { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
                    onMouseLeave={e => { if (plan.btnLabel !== 'Coming Soon') { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' } }}
                  >
                    {user && plan.btnLabel === 'Start for free' ? 'Go to dashboard' : plan.btnLabel}
                  </button>
                </motion.div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="landing-cta-section" style={{ padding: '80px 48px 120px', maxWidth: 1100, margin: '0 auto' }}>
        <Reveal>
          <div className="landing-cta-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 28, padding: '80px 48px', textAlign: 'center' }}>
            <h2 style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 300, letterSpacing: '-0.025em', color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 16 }}>
              Your program<br />is waiting.
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 300, marginBottom: 36 }}>
              {user ? 'Pick up right where you left off.' : 'Start free. No credit card required. Cancel anytime.'}
            </p>
            <Link to={user ? '/home' : '/signup'} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, background: 'var(--green)', color: '#000', border: 'none', borderRadius: 100, padding: '14px 32px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
              {user ? 'Go to dashboard' : 'Start for free'}
            </Link>
          </div>
        </Reveal>
      </div>

      {/* ── FOOTER ── */}
      <footer className="landing-footer" style={{ borderTop: '1px solid var(--border)', padding: '28px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>FITAGENT</span>
        <div style={{ display: 'flex', gap: 28 }}>
          {['Privacy Policy', 'Terms of Service', 'Contact'].map(label => (
            <a key={label} href="#" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = 'var(--text-secondary)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
            >{label}</a>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Powered by Claude AI</span>
      </footer>

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 768px) {
          .landing-nav-links { display: none !important; }
          .landing-nav-actions { display: none !important; }
          .landing-hamburger { display: flex !important; }

          nav { padding: 0 20px !important; }

          .landing-hero-card { width: calc(100vw - 48px) !important; max-width: 340px !important; }

          .landing-section { padding: 0 20px !important; }
          .landing-section > div { padding: 64px 0 !important; }

          .landing-problem-grid { grid-template-columns: 1fr !important; }

          .landing-features-grid { grid-template-columns: 1fr !important; }
          .landing-feature-mockup { height: 280px !important; }

          .landing-hiw-grid { grid-template-columns: 1fr !important; }

          .landing-pricing-grid { grid-template-columns: 1fr !important; max-width: 100% !important; }

          .landing-cta-section { padding: 48px 20px 80px !important; }
          .landing-cta-card { padding: 48px 24px !important; }

          .landing-footer {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
            padding: 24px 20px !important;
          }
        }
      `}</style>

    </div>
  )
}
