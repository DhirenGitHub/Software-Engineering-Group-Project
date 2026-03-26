import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp } from 'lucide-react'

/**
 * FootfallChart — weekly footfall bar chart shown in the right sidebar.
 */
export default function FootfallChart({ data }) {
  const max = Math.max(...data.map((d) => d.count))

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <TrendingUp size={12} color="#626261" strokeWidth={1.5} />
        <span style={styles.title}>FOOTFALL TRENDS</span>
      </div>
      <div style={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={data} barSize={18} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 8, fill: '#3c3d3c', fontFamily: 'Inter' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 7, fill: '#2a2a2a', fontFamily: 'Inter' }}
              axisLine={false}
              tickLine={false}
              tickCount={4}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f0f0f',
                border: '1px solid #1e1e1e',
                borderRadius: '4px',
                fontSize: '10px',
                color: '#7a7a7a',
              }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.day}
                  fill={entry.count === max ? '#d52521' : '#1e1e1e'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const styles = {
  panel: {
    padding: '10px 12px',
    borderTop: '1px solid #141414',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  title: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#626261',
    letterSpacing: '0.06em',
  },
  chartWrap: {
    width: '100%',
  },
}
