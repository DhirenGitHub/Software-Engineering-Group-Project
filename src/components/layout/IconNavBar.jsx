import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutGrid,
  TriangleAlert,
  BarChart3,
  Settings,
} from 'lucide-react'

/**
 * IconNavBar — 65px left vertical navigation with icon buttons.
 * Routes: Dashboard (/), Analytics (/analytics), Settings (/settings)
 */
const navItems = [
  { icon: LayoutGrid, path: '/',          tooltip: 'Live Dashboard' },
  { icon: TriangleAlert, path: '/alerts', tooltip: 'Alerts & Events' },
  { icon: BarChart3,  path: '/analytics', tooltip: 'Analytics'      },
  { icon: Settings,   path: '/settings',  tooltip: 'Settings'       },
]

export default function IconNavBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isActive = (path) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)

  return (
    <nav style={styles.nav}>
      <div style={styles.icons}>
        {navItems.map(({ icon: Icon, path, tooltip }) => {
          const active = isActive(path)
          return (
            <button
              type="button"
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
    </nav>
  )
}

const styles = {
  nav: {
    display: 'flex',
    flexDirection: 'column',
    width: '65px',
    flexShrink: 0,
    backgroundColor: '#080808',
    borderRight: '1px solid #111111',
    height: '100%',
    paddingTop: '44px',
  },
  icons: {
    display: 'flex',
    flexDirection: 'column',
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
}
