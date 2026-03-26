import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutGrid,
  BarChart2,
  Settings,
  User,
} from 'lucide-react'

/**
 * IconNavBar — 65px left vertical navigation with icon buttons.
 * Routes: Dashboard (/), Analytics (/analytics), Settings (/settings)
 */
const navItems = [
  { icon: LayoutGrid, path: '/',          tooltip: 'Live Dashboard' },
  { icon: BarChart2,  path: '/analytics', tooltip: 'Analytics'      },
  { icon: Settings,   path: '/settings',  tooltip: 'Settings'       },
]

export default function IconNavBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isActive = (path) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)

  return (
    <nav style={styles.nav}>
      {/* Icon slots */}
      <div style={styles.icons}>
        {navItems.map(({ icon: Icon, path, tooltip }) => {
          const active = isActive(path)
          return (
            <button
              key={path}
              title={tooltip}
              onClick={() => navigate(path)}
              style={{
                ...styles.iconBtn,
                backgroundColor: active ? 'rgba(213,37,33,0.12)' : 'transparent',
                borderRight: active ? '2px solid #d52521' : '2px solid transparent',
              }}
            >
              <Icon
                size={18}
                color={active ? '#d52521' : '#3a3a3a'}
                strokeWidth={active ? 2 : 1.5}
              />
            </button>
          )
        })}
      </div>

      {/* User avatar at bottom */}
      <div style={styles.avatar}>
        <User size={18} color="#3a3a3a" strokeWidth={1.5} />
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    width: '65px',
    flexShrink: 0,
    backgroundColor: '#080808',
    borderRight: '1px solid #111111',
    height: '100%',
  },
  icons: {
    display: 'flex',
    flexDirection: 'column',
    paddingTop: '12px',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '64px',
    height: '64px',
    borderRadius: 0,
    transition: 'background-color 0.15s',
    cursor: 'pointer',
  },
  avatar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '64px',
    height: '64px',
    marginBottom: '8px',
    cursor: 'pointer',
  },
}
