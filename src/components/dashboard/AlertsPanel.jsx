import { AlertTriangle, Bell } from 'lucide-react'
import Badge from '../ui/Badge'

/**
 * AlertsPanel — right sidebar alerts list.
 * Shows active alert count + scrollable list of alert rows.
 */
export default function AlertsPanel({ alerts }) {
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Bell size={13} color="#626261" strokeWidth={1.5} />
          <span style={styles.headerTitle}>ACTIVE ALERTS</span>
        </div>
        <Badge variant="critical">{criticalCount} CRITICAL</Badge>
      </div>

      {/* Alert list */}
      <div style={styles.list}>
        {alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} />
        ))}
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
          <span style={styles.metaDot}>·</span>
          <span style={styles.metaText}>{alert.target}</span>
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
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  alertType: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#7a7b7a',
    letterSpacing: '0.02em',
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
    color: '#3c3d3c',
    letterSpacing: '0.02em',
    fontVariantNumeric: 'tabular-nums',
  },
  metaDot: {
    fontSize: '10px',
    color: '#2a2a2a',
  },
  severityBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '2px',
  },
}
