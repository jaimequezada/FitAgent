// AgentMessage.jsx
// Renders a single message in the chat thread.
// User messages: right-aligned pill.
// Agent messages: left-aligned, full markdown via react-markdown + remark-gfm.
// Supports tables, headings, lists, bold, italic, code blocks.
// Supports <chart_json> blocks rendered via recharts.

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

// Strip and extract <chart_json> blocks before passing text to markdown
function parseCharts(text) {
  const charts = []
  const cleaned = text.replace(/<chart_json>([\s\S]*?)<\/chart_json>/g, (_, raw) => {
    try { charts.push(JSON.parse(raw.trim())) } catch { /* ignore malformed */ }
    return '%%CHART%%'
  })
  return { cleaned, charts }
}

function ChartBlock({ chart }) {
  const { type = 'line', title, data = [], xKey = 'label', yKey = 'value' } = chart
  const accent = '#39FF14'

  const tooltipStyle = {
    backgroundColor: '#1a1a1a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    fontSize: 12,
    color: '#f5f5f5',
  }

  return (
    <div className="my-4 rounded-xl overflow-hidden" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
      {title && (
        <p className="px-4 pt-4 pb-2 text-xs tracking-widest uppercase" style={{ color: '#a3a3a3' }}>{title}</p>
      )}
      <div className="px-2 pb-4" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fill: '#525252', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#525252', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(57,255,20,0.05)' }} />
              <Bar dataKey={yKey} fill={accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fill: '#525252', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#525252', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey={yKey} stroke={accent} strokeWidth={2} dot={{ fill: accent, r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Custom markdown components — styled to match the app's dark theme
const mdComponents = {
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h1 className="text-xl font-bold text-[var(--text-primary)] mb-3 mt-4 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2 mt-4 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2 mt-3 first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="mb-3 space-y-1 pl-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 space-y-1 pl-1 list-none">{children}</ol>,
  li: ({ children, ...props }) => {
    const isOrdered = props.node?.parent?.type === 'element' && props.node?.parent?.tagName === 'ol'
    return (
      <li className="flex gap-2 leading-relaxed">
        <span className="shrink-0 mt-px" style={{ color: '#a3a3a3' }}>{isOrdered ? '' : '–'}</span>
        <span>{children}</span>
      </li>
    )
  },
  code: ({ inline, children }) =>
    inline
      ? <code className="px-1.5 py-0.5 rounded text-[12px] font-mono" style={{ background: 'rgba(57,255,20,0.08)', color: '#39FF14' }}>{children}</code>
      : <pre className="my-3 p-4 rounded-xl overflow-x-auto text-[12px] font-mono leading-relaxed" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', color: '#a3a3a3' }}><code>{children}</code></pre>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead style={{ background: 'rgba(57,255,20,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{children}</tr>,
  th: ({ children }) => <th className="px-4 py-2.5 text-left text-[11px] tracking-widest uppercase font-semibold" style={{ color: '#a3a3a3' }}>{children}</th>,
  td: ({ children }) => <td className="px-4 py-2.5 text-[var(--text-primary)]">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 pl-4 italic" style={{ borderLeft: '2px solid rgba(57,255,20,0.4)', color: '#a3a3a3' }}>{children}</blockquote>
  ),
  hr: () => <hr className="my-4" style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)' }} />,
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: 'var(--accent-green)',
            opacity: 0.6,
            animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// Apply / Keep affordance shown under a check-in message that proposes a program change.
function CheckinProposal({ checkin, onApply, onDismiss }) {
  if (!checkin?.proposedProgram) return null
  const { status } = checkin

  if (status === 'applied') {
    return <p className="mt-3 text-[12px]" style={{ color: '#4a9a30' }}>✓ Program updated</p>
  }
  if (status === 'dismissed') {
    return <p className="mt-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>Kept your current program</p>
  }
  // pending
  return (
    <div className="mt-3 flex gap-8" style={{ alignItems: 'center' }}>
      <button
        onClick={onApply}
        style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
          background: 'var(--green)', color: '#000', border: 'none', borderRadius: 100,
          padding: '7px 16px', cursor: 'pointer',
        }}
      >Apply changes</button>
      <button
        onClick={onDismiss}
        style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 400,
          background: 'transparent', color: 'var(--text-muted)', border: 'none',
          cursor: 'pointer', textDecoration: 'underline', padding: '7px 0',
        }}
      >Keep as is</button>
    </div>
  )
}

export default function AgentMessage({ role, content, streaming, checkin, onApply, onDismiss }) {
  if (role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
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
        }}>
          {content}
        </div>
      </div>
    )
  }

  const isWaiting = streaming && !content

  const { cleaned, charts } = parseCharts(content || '')
  const segments = cleaned.split('%%CHART%%')

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
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
      }}>
        {isWaiting ? (
          <TypingDots />
        ) : (
          <>
            {segments.map((segment, i) => (
              <span key={i}>
                {segment && (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {segment}
                  </ReactMarkdown>
                )}
                {charts[i] && <ChartBlock chart={charts[i]} />}
              </span>
            ))}
            {streaming && (
              <span className="inline-block w-[2px] h-3.5 bg-[var(--text-secondary)] ml-0.5 align-middle animate-pulse" />
            )}
            <CheckinProposal checkin={checkin} onApply={onApply} onDismiss={onDismiss} />
          </>
        )}
      </div>
    </div>
  )
}
