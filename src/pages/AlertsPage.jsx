import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, Eye, ExternalLink, Filter, Search, Smartphone, TriangleAlert, Users, X } from 'lucide-react'
import PageLayout from '../components/layout/PageLayout'
import useLiveAlerts from '../hooks/useLiveAlerts'
import { useCameras } from '../context/CameraContext'

const SEVERITY_FILTERS = [
  { id: 'all', label: 'All Alerts' },
  { id: 'critical', label: 'High Priority' },
  { id: 'warning', label: 'Medium Priority' },
  { id: 'info', label: 'Low Priority' },
]

const CATEGORY_FILTERS = ['all', 'Device Misuse', 'Crowd Monitoring', 'Feed Health', 'General']
const STATUS_FILTERS = ['all', 'open', 'closed']

export default function AlertsPage() {
  const navigate = useNavigate()
  const { cameras } = useCameras()
  const { alerts, status } = useLiveAlerts()
  const [query, setQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('open')
  const [showFilters, setShowFilters] = useState(false)
  const [closedIds, setClosedIds] = useState([])

  const alertItems = useMemo(() => (
    alerts.map((alert) => ({
      ...alert,
      status: closedIds.includes(alert.id) ? 'closed' : (alert.status || 'open'),
    }))
  ), [closedIds, alerts])

  const camerasByAlertId = useMemo(() => (
    new Map(cameras.flatMap((camera) => {
      const keys = [camera.id, camera.backendId].filter(Boolean)
      return keys.map((key) => [key, camera])
    }))
  ), [cameras])

  const visibleAlerts = useMemo(() => {
    const q = query.trim().toLowerCase()

    return alertItems.filter((alert) => {
      const matchesSeverity = severityFilter === 'all' ? true : alert.severity === severityFilter
      const matchesCategory = categoryFilter === 'all' ? true : alert.category === categoryFilter
      const matchesStatus = statusFilter === 'all' ? true : alert.status === statusFilter
      const haystack = [
        alert.id,
        alert.type,
        alert.target,
        alert.cameraId,
        alert.detail,
        alert.category,
        alert.priorityLabel,
        alert.kind,
      ].join(' ').toLowerCase()
      const matchesQuery = q ? haystack.includes(q) : true
      return matchesSeverity && matchesCategory && matchesStatus && matchesQuery
    })
  }, [alertItems, categoryFilter, query, severityFilter, statusFilter])

  const counts = useMemo(() => ({
    critical: alertItems.filter((alert) => alert.status !== 'closed' && alert.severity === 'critical').length,
    warning: alertItems.filter((alert) => alert.status !== 'closed' && alert.severity === 'warning').length,
    info: alertItems.filter((alert) => alert.status !== 'closed' && alert.severity === 'info').length,
    open: alertItems.filter((alert) => alert.status !== 'closed').length,
  }), [alertItems])

  const handleAcknowledge = (alertId) => {
    setClosedIds((current) => (
      current.includes(alertId) ? current : [...current, alertId]
    ))
  }

  const clearFilters = () => {
    setQuery('')
    setSeverityFilter('all')
    setCategoryFilter('all')
    setStatusFilter('open')
  }

  return (
    <PageLayout title="ALERTS & EVENTS">
      <div style={styles.page}>
        <div style={styles.toolbar}>
          <div style={styles.searchWrap}>
            <Search size={16} color="#5a5a5a" strokeWidth={1.7} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search alert ID, type, camera or category..."
              style={styles.searchInput}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            style={{
              ...styles.filterButton,
              ...(showFilters ? styles.filterButtonActive : null),
            }}
          >
            <Filter size={15} color={showFilters ? '#ff5b51' : '#9a9a9a'} strokeWidth={1.7} />
            <span>{showFilters ? 'Hide Filters' : 'Filters'}</span>
          </button>

          <div style={styles.legend}>
            <LegendDot color="#ff5b51" label={`High (${counts.critical})`} />
            <LegendDot color="#d8b25a" label={`Medium (${counts.warning})`} />
            <LegendDot color="#6d8dff" label={`Low (${counts.info})`} />
            <LegendDot color="#5f5f5f" label={`Open (${counts.open})`} />
          </div>
        </div>

        <div style={styles.filterRow}>
          {SEVERITY_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSeverityFilter(item.id)}
              style={{
                ...styles.filterChip,
                ...(severityFilter === item.id ? styles.filterChipActive : null),
              }}
            >
              {item.label}
            </button>
          ))}
          <div style={styles.statusBadge}>
            <span style={{
              ...styles.statusDot,
              backgroundColor: status === 'live' ? '#ff4d43' : '#5d5d5d',
            }} />
            <span>{status === 'live' ? 'Detection Server Live' : 'Waiting For Backend'}</span>
          </div>
        </div>

        {showFilters && (
          <div style={styles.filterPanel}>
            <FilterGroup label="Category" values={CATEGORY_FILTERS} current={categoryFilter} onSelect={setCategoryFilter} />
            <FilterGroup label="Status" values={STATUS_FILTERS} current={statusFilter} onSelect={setStatusFilter} />
            <button type="button" onClick={clearFilters} style={styles.clearButton}>
              <X size={14} color="#9a9a9a" strokeWidth={1.8} />
              <span>Clear Filters</span>
            </button>
          </div>
        )}

        {visibleAlerts.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyTitle}>No alerts match the current filter</span>
            <span style={styles.emptyHint}>
              {status === 'live'
                ? 'Try triggering a phone, crowd, or feed-health event, or clear the search box.'
                : 'Make sure `python server/app.py` is running, then refresh this page.'}
            </span>
          </div>
        ) : (
          <div style={styles.grid}>
            {visibleAlerts.map((alert, index) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                camera={camerasByAlertId.get(alert.cameraId) || null}
                index={index}
                onAcknowledge={() => handleAcknowledge(alert.id)}
                onOpen={() => navigate('/')}
              />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

function LegendDot({ color, label }) {
  return (
    <span style={styles.legendItem}>
      <span style={{ ...styles.legendDot, backgroundColor: color }} />
      <span>{label}</span>
    </span>
  )
}

function FilterGroup({ label, values, current, onSelect }) {
  return (
    <div style={styles.filterGroup}>
      <span style={styles.filterGroupLabel}>{label}</span>
      <div style={styles.filterGroupValues}>
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            style={{
              ...styles.pillButton,
              ...(current === value ? styles.pillButtonActive : null),
            }}
          >
            {value === 'all' ? 'All' : value}
          </button>
        ))}
      </div>
    </div>
  )
}

function AlertCard({ alert, camera, index, onAcknowledge, onOpen }) {
  const tone = getAlertTone(alert.severity)
  const previewTone = getPreviewTone(alert.severity)
  const icon = getAlertIcon(alert.type)
  const isClosed = alert.status === 'closed'
  const isCameraAvailable = Boolean(camera)
  const previewSource = getAlertPreviewSource(alert, camera)
  const [previewFailed, setPreviewFailed] = useState(false)

  return (
    <article style={{ ...styles.card, ...tone }}>
      <div style={{ ...styles.preview, ...previewTone }}>
        <span style={styles.alertId}>ALT-{String(alert.id).padStart(3, '0')}</span>
        {!isCameraAvailable && (
          <span style={styles.previewStatus}>Feed Removed</span>
        )}
        {previewSource && !previewFailed ? (
          <img
            src={previewSource}
            alt={`${alert.type} preview`}
            style={styles.previewImage}
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <div style={styles.previewFallback}>
            <span style={styles.previewFallbackTitle}>
              {isCameraAvailable ? 'Preview Unavailable' : 'Archived Alert'}
            </span>
            <span style={styles.previewFallbackText}>
              {isCameraAvailable
                ? 'No frame could be loaded for this alert right now.'
                : 'This alert still has its details, but the original camera feed was removed from Settings.'}
            </span>
          </div>
        )}
        <div style={styles.previewNoise} />
      </div>

      <div style={styles.cardBody}>
        <div style={styles.titleRow}>
          <div style={styles.iconWrap}>{icon}</div>
          <div style={styles.titleStack}>
            <span style={styles.cardTitle}>{alert.type}</span>
            <div style={styles.badgeRow}>
              <span style={styles.categoryBadge}>{alert.category}</span>
              <span style={{
                ...styles.priorityBadge,
                ...(alert.severity === 'critical'
                  ? styles.priorityHigh
                  : alert.severity === 'warning'
                    ? styles.priorityMedium
                    : styles.priorityLow),
              }}>
                {alert.priorityLabel} Priority
              </span>
            </div>
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.metaGrid}>
          <div style={styles.metaBlock}>
            <span style={styles.metaLabel}>LOCATION</span>
            <span style={styles.metaValue}>{formatLocation(alert)}</span>
          </div>
          <div style={styles.metaBlockRight}>
            <span style={styles.metaLabel}>TIMESTAMP</span>
            <span style={styles.metaValue}>{formatTimestamp(alert.timestamp)}</span>
          </div>
        </div>

        <div style={styles.detailRow}>
          <span style={styles.detailText}>{alert.detail || 'Live event received from detector feed.'}</span>
          <span style={styles.sequenceText}>#{index + 1}</span>
        </div>

        <div style={styles.cardActions}>
          <button
            type="button"
            onClick={onOpen}
            style={{
              ...styles.actionPrimary,
              ...(!isCameraAvailable ? styles.actionUnavailable : null),
            }}
            disabled={!isCameraAvailable}
          >
            <ExternalLink size={14} color={isCameraAvailable ? '#f6f2f2' : '#8e8e8e'} strokeWidth={1.8} />
            <span>{isCameraAvailable ? 'Open Feed' : 'Feed Removed'}</span>
          </button>
          <button
            type="button"
            onClick={onAcknowledge}
            style={{
              ...styles.actionSecondary,
              ...(isClosed ? styles.actionDisabled : null),
            }}
            disabled={isClosed}
          >
            <CheckCheck size={14} color="#a0a0a0" strokeWidth={1.8} />
            <span>{isClosed ? 'Closed' : 'Close Alert'}</span>
          </button>
        </div>
      </div>
    </article>
  )
}

function getAlertTone(severity) {
  if (severity === 'critical') return styles.cardCritical
  if (severity === 'warning') return styles.cardWarning
  return styles.cardInfo
}

function getPreviewTone(severity) {
  if (severity === 'critical') return styles.previewCritical
  if (severity === 'warning') return styles.previewWarning
  return styles.previewInfo
}

function getAlertIcon(type) {
  const lower = String(type).toLowerCase()

  if (lower.includes('phone')) return <Smartphone size={16} color="#ff5b51" strokeWidth={1.8} />
  if (lower.includes('capacity') || lower.includes('crowd')) return <Users size={16} color="#d8b25a" strokeWidth={1.8} />
  if (lower.includes('timeout') || lower.includes('feed')) return <Eye size={16} color="#6d8dff" strokeWidth={1.8} />
  return <TriangleAlert size={16} color="#ff5b51" strokeWidth={1.8} />
}

function formatLocation(alert) {
  return alert.cameraId ? `${alert.cameraId}` : String(alert.target || 'LIVE FEED').toUpperCase()
}

function formatTimestamp(timestamp) {
  return timestamp ? `Today ${timestamp}` : 'Today --:--:--'
}

function getAlertPreviewSource(alert, camera) {
  if (alert.previewUrl) return alert.previewUrl
  if (camera?.sourceUrl) return camera.sourceUrl
  return null
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    padding: '22px 24px 26px',
    height: '100%',
    overflow: 'auto',
    backgroundColor: '#070707',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: 'min(100%, 420px)',
    backgroundColor: '#121212',
    border: '1px solid #1b1b1b',
    borderRadius: '6px',
    padding: '0 14px',
    height: '44px',
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#a7a7a7',
    fontSize: '14px',
  },
  filterButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    height: '44px',
    padding: '0 16px',
    borderRadius: '8px',
    border: '1px solid #1f1f1f',
    backgroundColor: '#141414',
    color: '#d8d8d8',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  filterButtonActive: {
    border: '1px solid #4d2020',
    backgroundColor: '#191010',
    color: '#ff5b51',
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: '22px',
    marginLeft: 'auto',
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#8a8a8a',
    fontSize: '13px',
  },
  legendDot: {
    width: '9px',
    height: '9px',
    borderRadius: '999px',
    display: 'inline-block',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  filterChip: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid #252525',
    backgroundColor: '#111111',
    color: '#8e8e8e',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  filterChipActive: {
    backgroundColor: '#2a0d0d',
    border: '1px solid #5d1f1f',
    color: '#ff5b51',
  },
  statusBadge: {
    marginLeft: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '999px',
    backgroundColor: '#101010',
    border: '1px solid #1e1e1e',
    color: '#8f8f8f',
    fontSize: '12px',
    fontWeight: 700,
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '999px',
    display: 'inline-block',
  },
  filterPanel: {
    border: '1px solid #191919',
    borderRadius: '12px',
    padding: '16px 18px',
    backgroundColor: '#0d0d0d',
    display: 'flex',
    gap: '18px',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  filterGroupLabel: {
    fontSize: '11px',
    color: '#5f5f5f',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  filterGroupValues: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  pillButton: {
    padding: '7px 12px',
    borderRadius: '999px',
    border: '1px solid #242424',
    backgroundColor: '#121212',
    color: '#8d8d8d',
    fontSize: '12px',
    cursor: 'pointer',
  },
  pillButtonActive: {
    border: '1px solid #424242',
    backgroundColor: '#1b1b1b',
    color: '#e2e2e2',
  },
  clearButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid #262626',
    backgroundColor: '#111111',
    color: '#9f9f9f',
    borderRadius: '8px',
    padding: '9px 12px',
    cursor: 'pointer',
  },
  emptyState: {
    border: '1px solid #181818',
    borderRadius: '12px',
    backgroundColor: '#0b0b0b',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    color: '#8b8b8b',
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#c0c0c0',
  },
  emptyHint: {
    fontSize: '13px',
    color: '#6f6f6f',
    lineHeight: 1.6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '16px',
  },
  card: {
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#141414',
    border: '1px solid #232323',
    minHeight: '310px',
    display: 'flex',
    flexDirection: 'column',
  },
  cardCritical: {
    boxShadow: 'inset 0 0 0 1px rgba(255, 82, 72, 0.3)',
  },
  cardWarning: {
    boxShadow: 'inset 0 0 0 1px rgba(216, 178, 90, 0.25)',
  },
  cardInfo: {
    boxShadow: 'inset 0 0 0 1px rgba(109, 141, 255, 0.25)',
  },
  preview: {
    position: 'relative',
    height: '188px',
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02)), radial-gradient(circle at 70% 30%, rgba(255,255,255,0.12), transparent 32%), linear-gradient(0deg, #1b1b1b, #0f0f0f)',
  },
  previewImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  previewCritical: {
    borderBottom: '1px solid rgba(255, 82, 72, 0.22)',
  },
  previewWarning: {
    borderBottom: '1px solid rgba(216, 178, 90, 0.22)',
  },
  previewInfo: {
    borderBottom: '1px solid rgba(109, 141, 255, 0.22)',
  },
  previewNoise: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 100%), linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 100%)',
    backgroundSize: '32px 32px',
    opacity: 0.22,
    pointerEvents: 'none',
  },
  previewFallback: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    gap: '6px',
    padding: '16px',
    background: 'linear-gradient(180deg, rgba(9,9,9,0.1) 0%, rgba(9,9,9,0.7) 72%, rgba(9,9,9,0.92) 100%)',
  },
  previewFallbackTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#d8d8d8',
  },
  previewFallbackText: {
    fontSize: '11px',
    color: '#9a9a9a',
    lineHeight: 1.5,
    maxWidth: '85%',
  },
  alertId: {
    position: 'absolute',
    top: '14px',
    left: '14px',
    zIndex: 1,
    padding: '5px 10px',
    borderRadius: '4px',
    backgroundColor: '#1b1b1b',
    color: '#8f8f8f',
    fontSize: '12px',
    fontWeight: 700,
  },
  previewStatus: {
    position: 'absolute',
    top: '14px',
    right: '14px',
    zIndex: 2,
    padding: '5px 10px',
    borderRadius: '999px',
    backgroundColor: 'rgba(12, 12, 12, 0.86)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#c4c4c4',
    fontSize: '11px',
    fontWeight: 700,
  },
  cardBody: {
    padding: '16px 16px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    flex: 1,
    backgroundColor: '#151515',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  titleStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  badgeRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  categoryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: '999px',
    backgroundColor: '#1b1b1b',
    color: '#aaaaaa',
    border: '1px solid #2a2a2a',
    fontSize: '11px',
    fontWeight: 700,
  },
  priorityBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
  },
  priorityHigh: {
    backgroundColor: '#2b1111',
    color: '#ff8a82',
    border: '1px solid #5d2020',
  },
  priorityMedium: {
    backgroundColor: '#2b2210',
    color: '#e0bf72',
    border: '1px solid #5a4720',
  },
  priorityLow: {
    backgroundColor: '#141d2f',
    color: '#93a8ff',
    border: '1px solid #30426f',
  },
  iconWrap: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    display: 'grid',
    placeItems: 'center',
    backgroundColor: '#101010',
    border: '1px solid #2a2a2a',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#d4d4d4',
  },
  divider: {
    height: '1px',
    backgroundColor: '#252525',
  },
  metaGrid: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '14px',
  },
  metaBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  metaBlockRight: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'flex-end',
    textAlign: 'right',
  },
  metaLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#555555',
    letterSpacing: '0.08em',
  },
  metaValue: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#8f8f8f',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    justifyContent: 'space-between',
  },
  detailText: {
    color: '#6b6b6b',
    fontSize: '13px',
    lineHeight: 1.5,
    maxWidth: '85%',
  },
  sequenceText: {
    color: '#4f4f4f',
    fontSize: '12px',
    fontWeight: 700,
  },
  cardActions: {
    display: 'flex',
    gap: '10px',
    marginTop: 'auto',
  },
  actionPrimary: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: '1px solid #532020',
    backgroundColor: '#ef3a2d',
    color: '#fff3f2',
    borderRadius: '8px',
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  actionSecondary: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: '1px solid #2a2a2a',
    backgroundColor: '#111111',
    color: '#b0b0b0',
    borderRadius: '8px',
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  actionDisabled: {
    opacity: 0.6,
    cursor: 'default',
  },
  actionUnavailable: {
    opacity: 0.45,
    cursor: 'default',
    border: '1px solid #2a2a2a',
    backgroundColor: '#171717',
    color: '#9b9b9b',
  },
}
