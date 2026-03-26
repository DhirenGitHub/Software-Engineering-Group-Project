import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

/**
 * CrowdCountChart — large area chart for crowd count over a time range.
 */
export default function CrowdCountChart({ data }) {
  return (
    <div style={styles.wrapper}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="crowdGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#d52521" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#d52521" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#141414"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fill: '#3c3d3c', fontFamily: 'Inter' }}
            axisLine={{ stroke: '#141414' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#3c3d3c', fontFamily: 'Inter' }}
            axisLine={false}
            tickLine={false}
            tickCount={5}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f0f0f',
              border: '1px solid #1e1e1e',
              borderRadius: '4px',
              fontSize: '10px',
              color: '#7a7a7a',
            }}
            cursor={{ stroke: '#2a2a2a', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#d52521"
            strokeWidth={1.5}
            fill="url(#crowdGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

const styles = {
  wrapper: {
    width: '100%',
    height: '100%',
  },
}
