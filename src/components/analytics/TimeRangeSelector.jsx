/**
 * TimeRangeSelector — ONE DAY / ONE WEEK / ONE MONTH / THREE MONTHS pill selector.
 */
const ranges = [
  { key: 'oneDay',       label: 'ONE DAY'      },
  { key: 'oneWeek',      label: 'ONE WEEK'     },
  { key: 'oneMonth',     label: 'ONE MONTH'    },
  { key: 'threeMonths',  label: 'THREE MONTHS' },
]

export default function TimeRangeSelector({ value, onChange }) {
  return (
    <div style={styles.wrapper}>
      {ranges.map(({ key, label }) => {
        const active = value === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              ...styles.pill,
              backgroundColor: active ? '#1a1a1a' : 'transparent',
              border: active ? '1px solid #2a2a2a' : '1px solid transparent',
              color: active ? '#7a7b7a' : '#3c3d3c',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    gap: '2px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #141414',
    borderRadius: '4px',
    padding: '2px',
  },
  pill: {
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    padding: '5px 10px',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'Inter, sans-serif',
  },
}
