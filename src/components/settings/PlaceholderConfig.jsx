/**
 * PlaceholderConfig — shown for settings sections not yet implemented.
 */
export default function PlaceholderConfig({ title }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.inner}>
        <span style={styles.label}>{title}</span>
        <span style={styles.sub}>Configuration panel coming soon</span>
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#2e2f2e',
    letterSpacing: '0.05em',
  },
  sub: {
    fontSize: '11px',
    color: '#242424',
  },
}
