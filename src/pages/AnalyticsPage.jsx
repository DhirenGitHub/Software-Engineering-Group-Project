import { useState } from 'react'
import PageLayout from '../components/layout/PageLayout'
import MetricCard from '../components/analytics/MetricCard'
import CrowdCountChart from '../components/analytics/CrowdCountChart'
import TimeRangeSelector from '../components/analytics/TimeRangeSelector'
import { crowdCountData, analyticsMetrics, cameras } from '../data/mockData'

/**
 * AnalyticsPage — crowd count chart + KPI metrics.
 * Layout: top KPI row + time range selector + large area chart.
 */
export default function AnalyticsPage() {
  const [range, setRange] = useState('oneDay')
  const [selectedCam, setSelectedCam] = useState('ALL')

  const chartData = crowdCountData[range] ?? crowdCountData.oneDay

  return (
    <PageLayout title="ANALYTICS ENGINE">
      <div style={styles.page}>
        {/* Top metrics row */}
        <div style={styles.metrics}>
          <MetricCard
            label="AVG CROWD"
            value="130"
            unit="ppl"
            description="Across all zones"
          />
          <MetricCard
            label="PEAK DWELL"
            value="14.2"
            unit="min"
            description="Food court · Zone B"
          />
          <MetricCard
            label="INCIDENTS"
            value="33"
            description="Last 24 hours"
          />
          <MetricCard
            label="CAMERA"
            value={selectedCam}
            description="Active feed source"
          />
        </div>

        {/* Controls row */}
        <div style={styles.controls}>
          <span style={styles.chartTitle}>CROWD COUNT OVER TIME</span>
          <div style={styles.controlsRight}>
            {/* Camera selector */}
            <div style={styles.camSelect}>
              {['ALL', ...cameras.map((c) => c.id)].map((id) => (
                <button
                  key={id}
                  onClick={() => setSelectedCam(id)}
                  style={{
                    ...styles.camPill,
                    backgroundColor: selectedCam === id ? '#1a1a1a' : 'transparent',
                    color: selectedCam === id ? '#7a7b7a' : '#3c3d3c',
                    border: selectedCam === id ? '1px solid #2a2a2a' : '1px solid transparent',
                  }}
                >
                  {id}
                </button>
              ))}
            </div>
            <TimeRangeSelector value={range} onChange={setRange} />
          </div>
        </div>

        {/* Chart */}
        <div style={styles.chartArea}>
          <CrowdCountChart data={chartData} />
        </div>

        {/* Bottom stat row */}
        <div style={styles.bottomStats}>
          {[
            { label: 'PEAK HOUR',     value: '14:00–15:00' },
            { label: 'MAX COUNT',     value: '487 ppl'     },
            { label: 'MIN COUNT',     value: '23 ppl'      },
            { label: 'TOTAL EVENTS',  value: '1,204'       },
            { label: 'TRIPWIRE HITS', value: '342'         },
            { label: 'ALERTS FIRED',  value: '33'          },
          ].map(({ label, value }) => (
            <div key={label} style={styles.statItem}>
              <span style={styles.statLabel}>{label}</span>
              <span style={styles.statValue}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  )
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '16px',
    gap: '14px',
    overflow: 'hidden',
  },
  metrics: {
    display: 'flex',
    gap: '10px',
    flexShrink: 0,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  chartTitle: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#626261',
    letterSpacing: '0.06em',
  },
  controlsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  camSelect: {
    display: 'flex',
    gap: '2px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #141414',
    borderRadius: '4px',
    padding: '2px',
  },
  camPill: {
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    padding: '5px 9px',
    borderRadius: '3px',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    transition: 'all 0.15s',
  },
  chartArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#090a0a',
    border: '1px solid #171717',
    borderRadius: '5px',
    padding: '8px 4px 4px',
    overflow: 'hidden',
  },
  bottomStats: {
    display: 'flex',
    gap: '10px',
    flexShrink: 0,
  },
  statItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    backgroundColor: '#090a0a',
    border: '1px solid #141414',
    borderRadius: '4px',
    padding: '10px 12px',
  },
  statLabel: {
    fontSize: '8px',
    fontWeight: 700,
    color: '#2e2f2e',
    letterSpacing: '0.07em',
  },
  statValue: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#5c5d5c',
    letterSpacing: '-0.01em',
    fontVariantNumeric: 'tabular-nums',
  },
}
