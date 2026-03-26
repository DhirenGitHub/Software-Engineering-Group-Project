/**
 * MetricCard — KPI card for the analytics page.
 * e.g. "A130", "14.2m", "33", "NTC"
 */
export default function MetricCard({ label, value, unit, description }) {
  return (
    <div style={styles.card}>
      <span style={styles.label}>{label}</span>
      <div style={styles.valueRow}>
        <span style={styles.value}>{value}</span>
        {unit && <span style={styles.unit}>{unit}</span>}
      </div>
      {description && <span style={styles.desc}>{description}</span>}
    </div>
  )
}

const styles = {
  card: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    backgroundColor: '#090a0a',
    border: '1px solid #171717',
    borderRadius: '5px',
    padding: '14px 16px',
  },
  label: {
    fontSize: '8px',
    fontWeight: 700,
    color: '#3c3d3c',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  valueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
  },
  value: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#8a8b89',
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
  },
  unit: {
    fontSize: '11px',
    fontWeight: 400,
    color: '#4a4a4a',
  },
  desc: {
    fontSize: '9px',
    color: '#3c3d3c',
    marginTop: '2px',
  },
}
