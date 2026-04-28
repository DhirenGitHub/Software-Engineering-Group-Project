import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import {
  Activity,
  ChevronDown,
  Smartphone,
  Target,
  Users,
} from 'lucide-react'
import PageLayout from '../components/layout/PageLayout'
import { useCameras } from '../context/CameraContext'
import useLiveAlerts from '../hooks/useLiveAlerts'
import useAnalyticsHistory from '../hooks/useAnalyticsHistory'
import useViewportWidth from '../hooks/useViewportWidth'

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'recent', label: 'Recent 30m' },
  { value: 'session', label: 'Live Session' },
]

export default function AnalyticsPage() {
  const viewportWidth = useViewportWidth()
  const compact = viewportWidth < 1220
  const { cameras } = useCameras()
  const { alerts } = useLiveAlerts()
  const { history, status } = useAnalyticsHistory()
  const [range, setRange] = useState('today')

  const visibleHistory = useMemo(() => filterHistory(history, range), [history, range])

  const footfallSeries = useMemo(
    () => buildFootfallSeries(visibleHistory, range),
    [visibleHistory, range],
  )

  const cameraActivitySeries = useMemo(
    () => buildCameraActivitySeries(visibleHistory, cameras),
    [visibleHistory, cameras],
  )

  const totalFootfall = useMemo(
    () => computeFootfall(visibleHistory),
    [visibleHistory],
  )

  const totalPhoneDetections = useMemo(
    () => computePhoneDetections(visibleHistory),
    [visibleHistory],
  )

  const peakOccupancy = useMemo(
    () => computePeakOccupancy(visibleHistory),
    [visibleHistory],
  )

  const zoneAlerts = alerts.length
  const footfallTrend = computeTrend(footfallSeries.map((point) => point.count))
  const phoneTrend = computeTrend(visibleHistory.map((sample) => sample.totalPhones || 0))
  const alertTrend = computeAlertTrend(alerts, visibleHistory)

  return (
    <PageLayout title="HISTORICAL ANALYTICS">
      <div style={styles.page}>
        <div style={styles.topMetrics}>
          <AnalyticsMetricCard
            label="TOTAL FOOTFALL"
            value={formatWholeNumber(totalFootfall)}
            meta={formatTrend(footfallTrend)}
            metaTone={footfallTrend > 0 ? 'good' : 'muted'}
            Icon={Users}
          />
          <AnalyticsMetricCard
            label="PHONE DETECTIONS"
            value={formatWholeNumber(totalPhoneDetections)}
            meta={formatTrend(phoneTrend)}
            metaTone={phoneTrend > 0 ? 'good' : 'muted'}
            Icon={Smartphone}
          />
          <AnalyticsMetricCard
            label="ZONE ALERTS"
            value={formatWholeNumber(zoneAlerts)}
            meta={formatTrend(alertTrend)}
            metaTone={zoneAlerts > 0 ? 'danger' : 'muted'}
            Icon={Activity}
          />
          <AnalyticsMetricCard
            label="PEAK OCCUPANCY"
            value={formatWholeNumber(peakOccupancy.count)}
            meta={status === 'live' ? peakOccupancy.label : 'Backend offline'}
            metaTone="muted"
            Icon={Target}
          />
        </div>

        <div style={compact ? styles.mainGridCompact : styles.mainGrid}>
          <section style={styles.chartPanel}>
            <div style={styles.panelHead}>
              <div style={styles.panelTitleWrap}>
                <span style={styles.panelTitle}>FOOTFALL DISTRIBUTION</span>
                <span style={styles.panelSubtitle}>Live traffic pattern across active feeds</span>
              </div>

              <div style={styles.selectWrap}>
                <select
                  value={range}
                  onChange={(event) => setRange(event.target.value)}
                  style={styles.select}
                >
                  {RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} color="#7b7c7a" strokeWidth={1.8} style={styles.selectIcon} />
              </div>
            </div>

            <div style={styles.chartArea}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={footfallSeries} margin={{ top: 16, right: 18, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d93a2f" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="#d93a2f" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#171717" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#3f403f', fontFamily: 'Inter' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#3f403f', fontFamily: 'Inter' }}
                    axisLine={false}
                    tickLine={false}
                    tickCount={5}
                    width={34}
                  />
                  <Tooltip
                    content={<FootfallTooltip />}
                    cursor={{ stroke: '#8d8d8d', strokeOpacity: 0.55, strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#d93a2f"
                    strokeWidth={2.1}
                    fill="url(#analyticsGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#d93a2f', stroke: '#ececeb', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              {status !== 'live' && (
                <div style={styles.chartOverlay}>Detection backend offline</div>
              )}
            </div>
          </section>

          <section style={styles.sidePanel}>
            <div style={styles.panelHead}>
              <div style={styles.panelTitleWrap}>
                <span style={styles.panelTitle}>ACTIVE CAMERA COUNTS</span>
              </div>
            </div>

            <div style={styles.sideChartArea}>
              {cameraActivitySeries.length === 0 ? (
                <div style={styles.emptyPanel}>
                  <span style={styles.emptyTitle}>No live camera counts yet</span>
                  <span style={styles.emptyText}>Keep detections running and this panel will fill itself in.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={cameraActivitySeries}
                    layout="vertical"
                    margin={{ top: 12, right: 10, left: 10, bottom: 10 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#3f403f', fontFamily: 'Inter' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={96}
                      tick={{ fontSize: 11, fill: '#656664', fontFamily: 'Inter' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<CameraActivityTooltip />}
                      cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={34}>
                      {cameraActivitySeries.map((item, index) => (
                        <Cell key={`${item.label}-${index}`} fill={index === 0 ? '#989898' : '#7b7b7b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  )
}

function AnalyticsMetricCard({ label, value, meta, metaTone, Icon }) {
  const metaStyle = metaTone === 'danger'
    ? styles.metricMetaDanger
    : metaTone === 'good'
      ? styles.metricMetaGood
      : styles.metricMetaMuted

  return (
    <article style={styles.metricCard}>
      <div style={styles.metricCardTop}>
        <span style={styles.metricLabel}>{label}</span>
        <span style={styles.metricIconWrap}>
          <Icon size={16} color="#b6b6b4" strokeWidth={1.7} />
        </span>
      </div>
      <div style={styles.metricCardBottom}>
        <span style={styles.metricValue}>{value}</span>
        <span style={{ ...styles.metricMeta, ...metaStyle }}>{meta}</span>
      </div>
    </article>
  )
}

function FootfallTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div style={styles.tooltipCard}>
      <span style={styles.tooltipTime}>{label}</span>
      <span style={styles.tooltipValue}>count : {formatWholeNumber(payload[0].value)}</span>
    </div>
  )
}

function CameraActivityTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div style={styles.tooltipCard}>
      <span style={styles.tooltipTime}>{label}</span>
      <span style={styles.tooltipValue}>people : {formatWholeNumber(payload[0].value)}</span>
    </div>
  )
}

function filterHistory(history, range) {
  if (history.length === 0) return []
  if (range === 'session') return history

  const latestSample = history[history.length - 1]
  if (range === 'recent') {
    return history.filter((sample) => latestSample.timestamp - sample.timestamp <= 30 * 60 * 1000)
  }

  return history.filter((sample) => isSameCalendarDay(sample.timestamp, latestSample.timestamp))
}

function buildFootfallSeries(history, range) {
  if (history.length === 0) {
    return buildFallbackFootfallSeries()
  }

  const deltaSamples = collectFootfallSamples(history)
  const hasMovement = deltaSamples.some((sample) => sample.delta > 0)
  const pointsTarget = range === 'recent' ? 8 : 12
  const chartSamples = deltaSamples.map((sample) => ({
    timestamp: sample.timestamp,
    count: hasMovement ? sample.delta : sample.occupancy,
  }))

  return bucketSeries(chartSamples, pointsTarget, hasMovement ? 'sum' : 'average')
}

function collectFootfallSamples(history) {
  const previousByCamera = new Map()

  return history.map((sample) => {
    let delta = 0

    sample.cameras.forEach((camera) => {
      const previousCount = previousByCamera.get(camera.cameraId) ?? 0
      delta += Math.max(0, camera.personCount - previousCount)
      previousByCamera.set(camera.cameraId, camera.personCount)
    })

    return {
      timestamp: sample.timestamp,
      count: delta > 0 ? delta : sample.totalPeople,
      delta,
      occupancy: sample.totalPeople,
    }
  })
}

function buildFallbackFootfallSeries() {
  const now = Date.now()

  return Array.from({ length: 8 }, (_, index) => ({
    label: formatShortTime(now - (7 - index) * 15 * 60 * 1000),
    count: 0,
  }))
}

function bucketSeries(series, targetPoints, mode) {
  if (series.length <= targetPoints) {
    return series.map((sample) => ({
      label: formatShortTime(sample.timestamp),
      count: roundForChart(sample.count),
    }))
  }

  const bucketSize = Math.ceil(series.length / targetPoints)
  const buckets = []

  for (let index = 0; index < series.length; index += bucketSize) {
    const chunk = series.slice(index, index + bucketSize)
    const values = chunk.map((item) => item.count)
    const count = mode === 'sum' ? sum(values) : average(values)
    const lastSample = chunk[chunk.length - 1]

    buckets.push({
      label: formatShortTime(lastSample.timestamp),
      count: roundForChart(count),
    })
  }

  return buckets
}

function buildCameraActivitySeries(history, cameras) {
  const latestSample = history[history.length - 1]
  if (!latestSample) return []

  return latestSample.cameras
    .map((camera) => {
      const cameraConfig = cameras.find((item) => item.backendId === camera.cameraId || item.id === camera.cameraId)
      return {
        label: cameraConfig?.location || cameraConfig?.label || camera.cameraId,
        count: Number(camera.personCount || 0),
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
}

function computeFootfall(history) {
  if (history.length === 0) return 0
  return sum(collectFootfallSamples(history).map((sample) => sample.delta))
}

function computePhoneDetections(history) {
  const previousByCamera = new Map()
  let totalDetections = 0

  history.forEach((sample) => {
    sample.cameras.forEach((camera) => {
      const previousCount = previousByCamera.get(camera.cameraId) ?? 0
      totalDetections += Math.max(0, camera.phoneCount - previousCount)
      previousByCamera.set(camera.cameraId, camera.phoneCount)
    })
  })

  return totalDetections
}

function computePeakOccupancy(history) {
  if (history.length === 0) return { count: 0, label: '--:--' }

  const peakSample = history.reduce((best, sample) => (
    sample.totalPeople > best.totalPeople ? sample : best
  ), history[0])

  return {
    count: peakSample.totalPeople,
    label: formatShortTime(peakSample.timestamp),
  }
}

function computeTrend(values) {
  const safeValues = values.filter((value) => Number.isFinite(value))
  if (safeValues.length < 4) return 0

  const half = Math.floor(safeValues.length / 2)
  const firstHalf = safeValues.slice(0, half)
  const secondHalf = safeValues.slice(half)
  const firstAvg = average(firstHalf)
  const secondAvg = average(secondHalf)

  if (firstAvg === 0) {
    return secondAvg === 0 ? 0 : 100
  }

  return ((secondAvg - firstAvg) / firstAvg) * 100
}

function computeAlertTrend(alerts, history) {
  if (history.length < 2 || alerts.length === 0) return 0

  const start = history[0].timestamp
  const end = history[history.length - 1].timestamp
  const midpoint = start + ((end - start) / 2)
  const alertTimes = alerts
    .map((alert) => Number(alert.eventTime || 0) * 1000)
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp >= start && timestamp <= end)

  if (alertTimes.length === 0) return 0

  const firstHalf = alertTimes.filter((timestamp) => timestamp < midpoint).length
  const secondHalf = alertTimes.filter((timestamp) => timestamp >= midpoint).length

  if (firstHalf === 0) {
    return secondHalf === 0 ? 0 : 100
  }

  return ((secondHalf - firstHalf) / firstHalf) * 100
}

function isSameCalendarDay(a, b) {
  const first = new Date(a)
  const second = new Date(b)

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

function average(values) {
  if (values.length === 0) return 0
  return sum(values) / values.length
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}

function roundForChart(value) {
  return Math.max(0, Math.round(value))
}

function formatTrend(value) {
  const rounded = Math.round(value * 10) / 10
  const prefix = rounded > 0 ? '+' : ''
  return `${prefix}${rounded.toFixed(1)}%`
}

function formatShortTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatWholeNumber(value) {
  return new Intl.NumberFormat().format(Math.round(value || 0))
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '24px 24px 22px',
    gap: '22px',
    overflow: 'auto',
    backgroundColor: '#070707',
  },
  topMetrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    flexShrink: 0,
  },
  metricCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '26px',
    minHeight: '114px',
    padding: '18px 20px',
    borderRadius: '4px',
    backgroundColor: '#0b0b0b',
    border: '1px solid #171717',
  },
  metricCardTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  metricLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#50514f',
    letterSpacing: '0.04em',
  },
  metricIconWrap: {
    display: 'grid',
    placeItems: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid #1d1d1d',
    backgroundColor: '#121212',
    flexShrink: 0,
  },
  metricCardBottom: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '12px',
  },
  metricValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#ccccca',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  metricMeta: {
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '2px',
    textAlign: 'right',
  },
  metricMetaGood: { color: '#2db55f' },
  metricMetaDanger: { color: '#e1473a' },
  metricMetaMuted: { color: '#5a5b5a' },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2.1fr) minmax(320px, 1fr)',
    gap: '22px',
    minHeight: 0,
    flex: 1,
  },
  mainGridCompact: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '18px',
    minHeight: 0,
    flex: 1,
  },
  chartPanel: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    backgroundColor: '#0b0b0b',
    border: '1px solid #171717',
    borderRadius: '6px',
    padding: '18px 20px 16px',
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    backgroundColor: '#0b0b0b',
    border: '1px solid #171717',
    borderRadius: '6px',
    padding: '18px 18px 16px',
  },
  panelHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '14px',
    marginBottom: '14px',
    flexShrink: 0,
  },
  panelTitleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  panelTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#9a9b99',
    letterSpacing: '0.03em',
  },
  panelSubtitle: {
    fontSize: '12px',
    color: '#4c4d4c',
    lineHeight: 1.5,
  },
  selectWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  select: {
    minWidth: '108px',
    height: '32px',
    padding: '0 34px 0 12px',
    borderRadius: '4px',
    border: '1px solid #1d1d1d',
    backgroundColor: '#1a1a1a',
    color: '#8a8b89',
    fontSize: '12px',
    outline: 'none',
    appearance: 'none',
  },
  selectIcon: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  chartArea: {
    position: 'relative',
    flex: 1,
    minHeight: '460px',
  },
  chartOverlay: {
    position: 'absolute',
    right: '14px',
    top: '8px',
    padding: '6px 10px',
    borderRadius: '999px',
    backgroundColor: 'rgba(43, 17, 17, 0.92)',
    border: '1px solid #5d2020',
    color: '#ff8a82',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  sideChartArea: {
    flex: 1,
    minHeight: '460px',
    position: 'relative',
  },
  emptyPanel: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '8px',
    color: '#5d5e5d',
    padding: '0 8px',
  },
  emptyTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#8a8b89',
  },
  emptyText: {
    fontSize: '12px',
    lineHeight: 1.6,
    color: '#565756',
  },
  tooltipCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: '88px',
    padding: '12px 14px',
    backgroundColor: '#171717',
    border: '1px solid #232323',
    borderRadius: '6px',
    boxShadow: '0 10px 24px rgba(0,0,0,0.38)',
  },
  tooltipTime: {
    fontSize: '13px',
    color: '#a3a4a2',
    fontVariantNumeric: 'tabular-nums',
  },
  tooltipValue: {
    fontSize: '14px',
    color: '#d14539',
    fontWeight: 500,
  },
}
