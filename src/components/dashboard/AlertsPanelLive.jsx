import { AlertTriangle, Bell } from 'lucide-react'
import Badge from '../ui/Badge'

export default function AlertsPanelLive({ alerts, status = 'idle' }) {
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const isOffline = status === 'offline'
  const statusLabel = isOffline ? 'SERVER OFFLINE' : status === 'live' ? 'LIVE' : 'CONNECTING'

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Bell size={13} color="#626261" strokeWidth={1.5} />
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
                : 'If detections are visible but alerts stay empty, restart `python server/app.py` once so the new alerts endpoint is loaded.'}
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
  const isCritical = alert.severity === 'critical'

  return (
    <div style={styles.row}>
      <AlertTriangle
        size={12}
        color={isCritical ? '#d52521' : '#c4891a'}
        strokeWidth={1.5}
        style={{ flexShrink: 0, marginTop: '1px' }}
      />
      <div style={styles.rowContent}>
        <span style={styles.alertType}>{alert.type}</span>
        <div style={styles.rowMeta}>
          <span style={styles.metaText}>{alert.timestamp}</span>
          <span style={styles.metaDot}>*</span>
          <span style={styles.metaText}>{alert.target}</span>
        </div>
        {alert.detail && (
          <span style={styles.detailText}>{alert.detail}</span>
        )}
        <div style={styles.cameraChipRow}>
          <span style={styles.cameraChip}>{alert.cameraId || 'LIVE FEED'}</span>
        </div>
      </div>
      <div
        style={{
          ...styles.severityBar,
          backgroundColor: isCritical ? 'rgba(213,37,33,0.4)' : 'rgba(196,137,26,0.3)',
        }}
      />
    </div>
  )
}

const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderBottom: '1px solid #141414',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
  },
  headerBadges: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  headerTitle: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#626261',
    letterSpacing: '0.06em',
  },
  list: {
    overflowY: 'auto',
    flex: 1,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '14px 12px 16px',
    borderBottom: '1px solid #0e0e0e',
  },
  emptyTitle: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#6d6f6d',
    letterSpacing: '0.04em',
  },
  emptyHint: {
    fontSize: '9px',
    color: '#3c3d3c',
    lineHeight: 1.5,
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '9px 12px',
    borderBottom: '1px solid #0e0e0e',
    position: 'relative',
    transition: 'background-color 0.1s',
    cursor: 'default',
  },
  rowContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    flex: 1,
    minWidth: 0,
  },
  alertType: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#c0c0bf',
    letterSpacing: '0.04em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  metaText: {
    fontSize: '9px',
    color: '#666865',
    letterSpacing: '0.02em',
    fontVariantNumeric: 'tabular-nums',
  },
  metaDot: {
    fontSize: '9px',
    color: '#2a2a2a',
  },
  detailText: {
    fontSize: '9px',
    color: '#484A48',
    lineHeight: 1.45,
  },
  cameraChipRow: {
    display: 'flex',
    marginTop: '2px',
  },
  cameraChip: {
    fontSize: '8px',
    fontWeight: 700,
    color: '#A8AAA8',
    backgroundColor: '#111111',
    border: '1px solid #202020',
    borderRadius: '999px',
    padding: '2px 6px',
    letterSpacing: '0.06em',
  },
  severityBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '2px',
  },
}
