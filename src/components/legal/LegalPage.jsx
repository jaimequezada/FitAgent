// Shared shell for the public legal pages (/privacy, /terms, /support).
// Content typography is scoped via the .legal-body class below.
import { Link } from 'react-router-dom'

export default function LegalPage({ label, title, updated, children }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 48px', borderBottom: '1px solid var(--border)',
      }}>
        <Link to="/" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-primary)', textDecoration: 'none' }}>
          FITAGENT
        </Link>
        <Link to="/" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
          Back to home
        </Link>
      </nav>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '64px 24px 96px' }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 16 }}>
          {label}
        </p>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.2 }}>
          {title}
        </h1>
        {updated && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 48 }}>
            Last updated {updated}
          </p>
        )}
        <div className="legal-body">{children}</div>
      </main>

      <footer style={{
        borderTop: '1px solid var(--border)', padding: '28px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>FITAGENT</span>
        <div style={{ display: 'flex', gap: 28 }}>
          {[['Privacy Policy', '/privacy'], ['Terms of Service', '/terms'], ['Support', '/support']].map(([text, href]) => (
            <Link key={href} to={href} style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
              {text}
            </Link>
          ))}
        </div>
      </footer>

      <style>{`
        .legal-body { margin-top: 24px; }
        .legal-body h2 {
          font-size: 17px; font-weight: 500; letter-spacing: -0.01em;
          color: var(--text-primary); margin: 40px 0 12px;
        }
        .legal-body p {
          font-size: 15px; font-weight: 300; line-height: 1.7;
          color: var(--text-secondary); margin: 0 0 14px;
        }
        .legal-body ul {
          margin: 0 0 14px; padding-left: 22px;
        }
        .legal-body li {
          font-size: 15px; font-weight: 300; line-height: 1.7;
          color: var(--text-secondary); margin-bottom: 8px;
        }
        .legal-body a {
          color: var(--text-primary); text-decoration: underline;
          text-underline-offset: 3px;
        }
        .legal-body strong {
          font-weight: 500; color: var(--text-primary);
        }
      `}</style>
    </div>
  )
}
