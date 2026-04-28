import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCheck,
  ExternalLink,
  Eye,
  Filter,
  Search,
  Smartphone,
  TriangleAlert,
  Users,
  WifiOff,
  X,
} from 'lucide-react'
import PageLayout from '../components/layout/PageLayout'
import useLiveAlerts from '../hooks/useLiveAlerts'
import { useCameras } from '../context/CameraContext'
import useViewportWidth from '../hooks/useViewportWidth'

const SEVERITY_FILTERS = [
  { id: 'all', label: 'All Priorities' },
  { id: 'critical', label: 'High Priority' },
  { id: 'warning', label: 'Medium Priority' },
  { id: 'info', label: 'Low Priority' },
]

const CATEGORY_FILTERS = ['all', 'Device Misuse', 'Crowd Monitoring', 'Feed Health', 'General']
const STATUS_FILTERS = ['all', 'open', 'acknowledged', 'resolved']

export default function AlertsPage() {
  const navigate = useNavigate()
  const viewportWidth = useViewportWidth()
  const compact = viewportWidth < 1180
  const narrowCards = viewportWidth < 760
  const { cameras } = useCameras()
  const { alerts, status } = useLiveAlerts()
  const [query, setQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [statusOverrides, setStatusOverrides] = useState({})

  const alertItems = useMemo(() => (
    alerts.map((alert) => ({
      ...alert,
      status: statusOverrides[alert.id] || alert.status || 'open',
    }))
  ), [alerts, statusOverrides])

  const camerasByAlertId = useMemo(() => (
    new Map(cameras.flatMap((camera) => {
      const keys = [camera.id, camera.backendId].filter(Boolean)
      return keys.map((key) => [key, camera])
    }))
  ), [cameras])

  const visibleAlerts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return alertItems.filter((alert) => {
      const matchesSeverity = severityFilter === 'all' ? true : alert.severity === severityFilter
      const matchesCategory = categoryFilter === 'all' ? true : alert.category === categoryFilter
      const matchesStatus = statusFilter === 'all' ? true : alert.status === statusFilter
      const searchHaystack = [
        alert.id,
        alert.type,
        alert.target,
        alert.cameraId,
        alert.detail,
        alert.category,
      ].join(' ').toLowerCase()
      const matchesQuery = normalizedQuery ? searchHaystack.includes(normalizedQuery) : true
      return matchesSeverity && matchesCategory && matchesStatus && matchesQuery
    })
  }, [alertItems, categoryFilter, query, severityFilter, statusFilter])

  const counts = useMemo(() => ({
    critical: alertItems.filter((alert) => alert.status !== 'resolved' && alert.severity === 'critical').length,
    warning: alertItems.filter((alert) => alert.status !== 'resolved' && alert.severity === 'warning').length,
    info: alertItems.filter((alert) => alert.status !== 'resolved' && alert.severity === 'info').length,
  }), [alertItems])

  const updateAlertStatus = (alertId, nextStatus) => {
    setStatusOverrides((current) => ({ ...current, [alertId]: nextStatus }))
  }

  const clearFilters = () => {
    setQuery('')
    setSeverityFilter('all')
    setCategoryFilter('all')
    setStatusFilter('all')
  }

  return (
    <PageLayout title="ALERTS & EVENTS">
      <div style={styles.page}>
        <div style={compact ? styles.toolbarCompact : styles.toolbar}>
          <div style={compact ? styles.searchWrapCompact : styles.searchWrap}>
            <Search size={16} color="#5a5a5a" strokeWidth={1.7} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search alert ID, type or camera..."
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
            <span>Filters</span>
          </button>

          <div style={compact ? styles.legendCompact : styles.legend}>
            <LegendDot color="#ff5b51" label={`High Priority (${counts.critical})`} />
            <LegendDot color="#d8b25a" label={`Medium Priority (${counts.warning})`} />
            <LegendDot color="#8f8f8f" label={`Low Priority (${counts.info})`} />
          </div>
        </div>

        {showFilters && (
          <div style={styles.filterPanel}>
            <FilterGroup label="Priority" values={SEVERITY_FILTERS} current={severityFilter} onSelect={setSeverityFilter} />
            <FilterGroup label="Category" values={CATEGORY_FILTERS} current={categoryFilter} onSelect={setCategoryFilter} />
            <FilterGroup label="Status" values={STATUS_FILTERS} current={statusFilter} onSelect={setStatusFilter} />
            <div style={styles.filterPanelActions}>
              <div style={styles.statusBadge}>
                <span style={{ ...styles.statusDot, backgroundColor: status === 'live' ? '#ff4d43' : '#5d5d5d' }} />
                <span>{status === 'live' ? 'Detection Server Live' : 'Waiting For Backend'}</span>
              </div>
              <button type="button" onClick={clearFilters} style={styles.clearButton}>
                <X size={14} color="#9a9a9a" strokeWidth={1.8} />
                <span>Clear</span>
              </button>
            </div>
          </div>
        )}

        {visibleAlerts.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyTitle}>No alerts match the current filter</span>
            <span style={styles.emptyHint}>
              {status === 'live'
                ? 'Try a different query, or let the detector run until new phone, crowd, or feed alerts arrive.'
                : 'Make sure `python server/app.py` is running, then refresh this page.'}
            </span>
          </div>
        ) : (
          <div style={compact ? styles.gridCompact : styles.grid}>
            {visibleAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                camera={camerasByAlertId.get(alert.cameraId) || null}
                onOpen={() => navigate('/')}
                onStatusChange={updateAlertStatus}
                compact={narrowCards}
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
        {values.map((value) => {
          const normalizedValue = typeof value === 'string' ? value : value.id
          const displayLabel = typeof value === 'string' ? (value === 'all' ? 'All' : capitalize(value)) : value.label

          return (
            <button
              key={normalizedValue}
              type="button"
              onClick={() => onSelect(normalizedValue)}
              style={{
                ...styles.pillButton,
                ...(current === normalizedValue ? styles.pillButtonActive : null),
              }}
            >
              {displayLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AlertCard({ alert, camera, onOpen, onStatusChange, compact = false }) {
  const tone = getAlertTone(alert.severity)
  const previewTone = getPreviewTone(alert.severity)
  const icon = getAlertIcon(alert.kind || alert.type)
  const previewSource = getAlertPreviewSource(alert, camera)
  const [previewFailed, setPreviewFailed] = useState(false)
  const nextStatus = alert.status === 'open' ? 'acknowledged' : 'resolved'

  return (
    <article style={{ ...styles.card, ...tone }}>
      <div style={{ ...styles.preview, ...previewTone }}>
        <span style={styles.alertId}>ALT-{String(alert.id).padStart(3, '0')}</span>

        {previewSource && !previewFailed ? (
          <img
            src={previewSource}
            alt={`${alert.type} preview`}
            style={styles.previewImage}
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <div style={styles.previewFallback}>
            <span style={styles.previewFallbackTitle}>Preview unavailable</span>
            <span style={styles.previewFallbackText}>This alert still has its metadata, but no frame could be loaded right now.</span>
          </div>
        )}
      </div>

      <div style={styles.cardBody}>
        <div style={styles.titleRow}>
          <div style={styles.iconWrap}>{icon}</div>
          <span style={styles.cardTitle}>{alert.type}</span>
        </div>

        <div style={styles.divider} />

        <div style={styles.metaGrid}>
          <div style={styles.metaBlock}>
            <span style={styles.metaLabel}>LOCATION</span>
            <span style={styles.metaValue}>{formatLocation(alert, camera)}</span>
          </div>
          <div style={styles.metaBlockRight}>
            <span style={styles.metaLabel}>TIMESTAMP</span>
            <span style={styles.metaValue}>{formatTimestamp(alert.timestamp)}</span>
          </div>
        </div>

        <div style={styles.detailRow}>
          <span style={styles.detailText}>{alert.detail || 'Live event received from the detector feed.'}</span>
        </div>

        <div style={compact ? styles.cardActionsCompact : styles.cardActions}>
          <button type="button" onClick={onOpen} style={styles.actionGhost}>
            <ExternalLink size={14} color="#d0d0ce" strokeWidth={1.8} />
            <span>Open Feed</span>
          </button>
          <button
            type="button"
            onClick={() => onStatusChange(alert.id, nextStatus)}
            style={alert.status === 'resolved' ? styles.actionDisabled : styles.actionPrimary}
            disabled={alert.status === 'resolved'}
          >
            <CheckCheck size={14} color={alert.status === 'resolved' ? '#8e8e8e' : '#f3f0f0'} strokeWidth={1.8} />
            <span>{alert.status === 'open' ? 'Acknowledge' : alert.status === 'acknowledged' ? 'Resolve' : 'Resolved'}</span>
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

function getAlertIcon(kind) {
  const lower = String(kind).toLowerCase()

  if (lower.includes('phone')) return <Smartphone size={16} color="#ff5b51" strokeWidth={1.8} />
  if (lower.includes('capacity') || lower.includes('crowd')) return <Users size={16} color="#d8b25a" strokeWidth={1.8} />
  if (lower.includes('timeout') || lower.includes('feed')) return <WifiOff size={16} color="#8798ff" strokeWidth={1.8} />
  if (lower.includes('tripwire')) return <Eye size={16} color="#b4b4b2" strokeWidth={1.8} />
  return <TriangleAlert size={16} color="#ff5b51" strokeWidth={1.8} />
}

function getAlertPreviewSource(alert, camera) {
  if (alert.previewUrl) return alert.previewUrl
  if (camera?.sourceUrl) return camera.sourceUrl
  return null
}

function formatLocation(alert, camera) {
  const location = camera?.location || alert.target || alert.cameraId || 'LIVE FEED'
  const cameraLabel = camera?.label || alert.cameraId || ''
  return cameraLabel ? `${cameraLabel} - ${String(location).toUpperCase()}` : String(location).toUpperCase()
}

function formatTimestamp(timestamp) {
  return timestamp ? `Today ${timestamp}` : 'Today --:--:--'
}

function formatStatus(status) {
  if (status === 'acknowledged') return 'ACKNOWLEDGED'
  if (status === 'resolved') return 'RESOLVED'
  return 'OPEN'
}

function getStatusStyle(status) {
  if (status === 'acknowledged') return styles.statusAcknowledged
  if (status === 'resolved') return styles.statusResolved
  return styles.statusOpen
}

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
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
  toolbarCompact: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '12px',
    flexWrap: 'wrap',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: 'min(100%, 360px)',
    backgroundColor: '#121212',
    border: '1px solid #1b1b1b',
    borderRadius: '6px',
    padding: '0 14px',
    height: '38px',
  },
  searchWrapCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    minWidth: 0,
    backgroundColor: '#121212',
    border: '1px solid #1b1b1b',
    borderRadius: '6px',
    padding: '0 14px',
    height: '38px',
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
    height: '38px',
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
  legendCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    flexWrap: 'wrap',
    width: '100%',
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
    border: '1px solid #4d2020',
    backgroundColor: '#1b1010',
    color: '#ff5b51',
  },
  filterPanelActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginLeft: 'auto',
  },
  statusBadge: {
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
  gridCompact: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
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
    background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02)), linear-gradient(0deg, #1b1b1b, #0f0f0f)',
  },
  previewImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    filter: 'grayscale(100%)',
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
  previewFallback: {
    position: 'absolute',
    inset: 0,
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
  statusOpen: {
    position: 'absolute',
    top: '14px',
    right: '14px',
    zIndex: 1,
    padding: '5px 10px',
    borderRadius: '4px',
    backgroundColor: '#ef3a2d',
    color: '#fff1ef',
    fontSize: '11px',
    fontWeight: 700,
  },
  statusAcknowledged: {
    position: 'absolute',
    top: '14px',
    right: '14px',
    zIndex: 1,
    padding: '5px 10px',
    borderRadius: '4px',
    backgroundColor: '#d6a30e',
    color: '#fff7dc',
    fontSize: '11px',
    fontWeight: 700,
  },
  statusResolved: {
    position: 'absolute',
    top: '14px',
    right: '14px',
    zIndex: 1,
    padding: '5px 10px',
    borderRadius: '4px',
    backgroundColor: '#4f4f4f',
    color: '#e4e4e4',
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
    alignItems: 'center',
    gap: '12px',
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
    fontSize: '13px',
    fontWeight: 700,
    color: '#8f8f8f',
  },
  detailRow: {
    display: 'flex',
  },
  detailText: {
    color: '#6b6b6b',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  cardActions: {
    display: 'flex',
    gap: '10px',
    marginTop: 'auto',
  },
  cardActionsCompact: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '10px',
    marginTop: 'auto',
  },
  actionGhost: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: '1px solid #2a2a2a',
    backgroundColor: '#111111',
    color: '#d0d0ce',
    borderRadius: '8px',
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 700,
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
  actionDisabled: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: '1px solid #2a2a2a',
    backgroundColor: '#1a1a1a',
    color: '#8e8e8e',
    borderRadius: '8px',
    padding: '10px 12px',
    cursor: 'default',
    fontWeight: 700,
  },
}
