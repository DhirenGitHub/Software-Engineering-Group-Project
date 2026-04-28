import { MapPin } from 'lucide-react'

export default function ZoneAnalytics({ stats = [], title = 'ZONE ANALYTICS', subtitle = '(LIVE)' }) {
  const statsGridStyle = stats.length > 3
    ? styles.statsCompact
    : styles.stats

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <MapPin size={12} color="#626261" strokeWidth={1.5} />
        <span style={styles.title}>{title}</span>
        <span style={styles.subtitle}>{subtitle}</span>
      </div>
      <div style={statsGridStyle}>
        {stats.map(({ key, value }) => (
          <div key={key} style={styles.statCard}>
            <span style={styles.statValue}>{value}</span>
            <span style={styles.statLabel}>{key}</span>
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
    padding: '12px',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '12px',
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
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
  },
  statsCompact: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    minHeight: '68px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #141414',
    borderRadius: '6px',
    padding: '10px 6px',
  },
  statValue: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#d0d1cf',
    letterSpacing: '-0.01em',
    fontVariantNumeric: 'tabular-nums',
  },
  statLabel: {
    fontSize: '8px',
    fontWeight: 700,
    color: '#4c4d4c',
    letterSpacing: '0.08em',
  },
}
