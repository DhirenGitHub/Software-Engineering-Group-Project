import { MapPin } from 'lucide-react'

/**
 * ZoneAnalytics — Queue / Dwell / Loiter stat cards.
 */
export default function ZoneAnalytics({ data }) {
  const stats = [
    { key: 'QUEUE',  value: data.queue  },
    { key: 'DWELL',  value: data.dwell  },
    { key: 'LOITER', value: data.loiter },
  ]

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <MapPin size={12} color="#626261" strokeWidth={1.5} />
        <span style={styles.title}>ZONE ANALYTICS</span>
        <span style={styles.subtitle}>(LIVE)</span>
      </div>
      <div style={styles.stats}>
        {stats.map(({ key, value }) => (
          <div key={key} style={styles.statCard}>
            <span style={styles.statLabel}>{key}</span>
            <span style={styles.statValue}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  panel: {
    borderTop: '1px solid #141414',
    borderBottom: '1px solid #141414',
    padding: '10px 12px',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '10px',
  },
  title: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#626261',
    letterSpacing: '0.06em',
  },
  subtitle: {
    fontSize: '9px',
    color: '#3c3d3c',
    letterSpacing: '0.04em',
  },
  stats: {
    display: 'flex',
    gap: '6px',
  },
  statCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #141414',
    borderRadius: '4px',
    padding: '10px 6px',
  },
  statLabel: {
    fontSize: '8px',
    fontWeight: 700,
    color: '#3c3d3c',
    letterSpacing: '0.07em',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#8a8b89',
    letterSpacing: '-0.01em',
    fontVariantNumeric: 'tabular-nums',
  },
}
