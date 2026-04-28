import {
  Camera,
  SlidersHorizontal,
  Database,
  Bell,
} from 'lucide-react'

/**
 * SettingsSidebar — left text navigation for the Settings page.
 * Maps each settings section to an icon + label.
 */
const iconMap = {
  'camera-feeds':    Camera,
  'analytics-engine': SlidersHorizontal,
  'chromadb-status': Database,
  'alert-rules':     Bell,
}

export default function SettingsSidebar({ items, active, onSelect, compact = false }) {
  return (
    <nav style={compact ? styles.navCompact : styles.nav}>
      {items.map((item) => {
        const Icon = iconMap[item.id] || Camera
        const isActive = active === item.id

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            style={{
              ...(compact ? styles.itemCompact : styles.item),
              backgroundColor: isActive ? '#090a0a' : 'transparent',
              border: isActive ? '1px solid #171717' : '1px solid transparent',
            }}
          >
            <Icon
              size={13}
              color={isActive ? '#a32b28' : '#636463'}
              strokeWidth={1.5}
              style={{ flexShrink: 0 }}
            />
            <span
              style={{
                ...styles.label,
                color: isActive ? '#a32b28' : '#636463',
                fontWeight: isActive ? 700 : 700,
              }}
            >
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

const styles = {
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px 10px',
    width: '248px',
    flexShrink: 0,
    borderRight: '1px solid #141414',
    overflowY: 'auto',
  },
  navCompact: {
    display: 'flex',
    gap: '8px',
    padding: '12px',
    width: '100%',
    flexShrink: 0,
    borderBottom: '1px solid #141414',
    overflowX: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '46px',
    padding: '0 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.12s',
    textAlign: 'left',
    width: '100%',
  },
  itemCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '44px',
    padding: '0 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.12s',
    textAlign: 'left',
    minWidth: '180px',
    flexShrink: 0,
  },
  label: {
    fontSize: '12px',
    letterSpacing: '0.02em',
    fontFamily: 'Inter, sans-serif',
  },
}
