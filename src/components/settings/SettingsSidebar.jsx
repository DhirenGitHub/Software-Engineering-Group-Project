import {
  Camera,
  Cpu,
  Database,
  Shield,
  Bell,
  HardDrive,
  Users,
} from 'lucide-react'

/**
 * SettingsSidebar — left text navigation for the Settings page.
 * Maps each settings section to an icon + label.
 */
const iconMap = {
  'camera-feeds':       Camera,
  'analytics-engine':   Cpu,
  'nanodb-config':      Database,
  'security-access':    Shield,
  'alert-rules':        Bell,
  'storage-management': HardDrive,
  'user-management':    Users,
}

export default function SettingsSidebar({ items, active, onSelect }) {
  return (
    <nav style={styles.nav}>
      {items.map((item) => {
        const Icon = iconMap[item.id] || Camera
        const isActive = active === item.id

        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              ...styles.item,
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
    gap: '2px',
    padding: '8px',
    width: '216px',
    flexShrink: 0,
    borderRight: '1px solid #141414',
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    height: '45px',
    padding: '0 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.12s',
    textAlign: 'left',
    width: '100%',
  },
  label: {
    fontSize: '12px',
    letterSpacing: '0.02em',
    fontFamily: 'Inter, sans-serif',
  },
}
