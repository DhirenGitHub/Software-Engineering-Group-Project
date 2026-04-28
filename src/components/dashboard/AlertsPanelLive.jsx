import { AlertTriangle, Bell, Smartphone, Users, WifiOff } from 'lucide-react'
import Badge from '../ui/Badge'

export default function AlertsPanelLive({ alerts, status = 'idle' }) {
  const criticalCount = alerts.filter((alert) => alert.severity === 'critical' && alert.status !== 'resolved').length
  const isOffline = status === 'offline'
  const statusLabel = isOffline ? 'SERVER OFFLINE' : status === 'live' ? 'LIVE' : 'CONNECTING'

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Bell size={13} color="#c9c9c7" strokeWidth={1.6} />
          <span style={styles.headerTitle}>ACTIVE ALERTS</span>
        </div>
        <div style={styles.headerBadges}>
          <Badge variant={isOffline ? 'neutral' : 'critical'}>{statusLabel}</Badge>
          <Badge variant="critical">{criticalCount} CRITICAL</Badge>
        </div>
      </div>

      <div style={styles.list}>
        {alerts.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyTitle}>
              {isOffline ? 'Detection server unavailable' : 'No live alerts yet'}
            </span>
            <span style={styles.emptyHint}>
              {isOffline
                ? 'Start `python server/app.py` to stream live alert events into the dashboard.'
                : 'Trigger a phone, crowd, or feed-health event to populate the operator alert queue.'}
            </span>
          </div>
        ) : (
          alerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))
        )}
      </div>
    </div>
  )
}

function AlertRow({ alert }) {
  const icon = getAlertIcon(alert.kind || alert.type)
  const isCritical = alert.severity === 'critical'

  return (
    <div style={{ ...styles.row, ...(isCritical ? styles.rowCritical : styles.rowDefault) }}>
      <div style={styles.rowTop}>
        <div style={styles.rowTitleWrap}>
          <span style={styles.rowIcon}>{icon}</span>
          <span style={styles.alertType}>{alert.type}</span>
        </div>
        <span style={styles.alertTime}>{alert.timestamp || '--:--:--'}</span>
      </div>

      <div style={styles.rowBottom}>
        <span style={styles.alertTarget}>{alert.cameraId || alert.target || 'LIVE FEED'}</span>
        {alert.detail && (
          <span style={styles.alertDetail}>{alert.detail}</span>
        )}
      </div>
    </div>
  )
}

function getAlertIcon(kind) {
  const label = String(kind || '').toLowerCase()
  if (label.includes('phone')) return <Smartphone size={13} color="#ff5b51" strokeWidth={1.8} />
  if (label.includes('crowd') || label.includes('capacity')) return <Users size={13} color="#d8b25a" strokeWidth={1.8} />
  if (label.includes('offline') || label.includes('timeout')) return <WifiOff size={13} color="#7f8dff" strokeWidth={1.8} />
  return <AlertTriangle size={13} color="#ff5b51" strokeWidth={1.8} />
}

const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    borderBottom: '1px solid #141414',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerBadges: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  headerTitle: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#c9c9c7',
    letterSpacing: '0.06em',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px 12px 12px',
    overflowY: 'auto',
    minHeight: 0,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px 4px',
  },
  emptyTitle: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#8b8d8b',
    letterSpacing: '0.04em',
  },
  emptyHint: {
    fontSize: '10px',
    color: '#515351',
    lineHeight: 1.6,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #222222',
    backgroundColor: '#101010',
  },
  rowDefault: {
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
  },
  rowCritical: {
    border: '1px solid #4f1c1c',
    backgroundColor: '#160c0c',
  },
  rowTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  rowTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },
  rowIcon: {
    display: 'grid',
    placeItems: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    border: '1px solid #272727',
    backgroundColor: '#0d0d0d',
    flexShrink: 0,
  },
  alertType: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#d0d0ce',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  alertTime: {
    fontSize: '10px',
    color: '#7a7b79',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  rowBottom: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  alertTarget: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#8e908e',
    letterSpacing: '0.05em',
  },
  alertDetail: {
    fontSize: '10px',
    color: '#626362',
    lineHeight: 1.5,
  },
}
