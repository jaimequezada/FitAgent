// ProgressChart.jsx
// Line chart for the user's strongest tracked lift over time.
// Only renders when data has 3+ points.

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts'

export default function ProgressChart({ data, liftName }) {
  if (!data || data.length < 3) return null

  return (
    <div
      className="rounded-2xl px-5 pt-5 pb-4"
      style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <p className="text-[9px] tracking-[0.22em] text-[var(--text-secondary)] uppercase mb-4">
        {liftName}
      </p>
      <div style={{ height: 110 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.25)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.25)' }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="var(--accent-green)"
              strokeWidth={2}
              dot={{ fill: 'var(--accent-green)', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: 'var(--accent-green)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
