import { useEffect, useState } from 'react'
import StatusDot from '../ui/StatusDot'
import useViewportWidth from '../../hooks/useViewportWidth'

export default function TopHeader({ title = 'LIVE DASHBOARD' }) {
  const [now, setNow] = useState(new Date())
  const viewportWidth = useViewportWidth()
  const compact = viewportWidth < 980
  const logoSrc = '/wysetime-logo.png'

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

  const dayName = days[now.getDay()]
  const date = String(now.getDate()).padStart(2, '0')
  const month = months[now.getMonth()]
  const year = now.getFullYear()
  const time = now.toTimeString().slice(0, 8)

  return (
    <header style={styles.header}>
      <div style={styles.headerLeft}>
        <div style={styles.brandBlock}>
          <img
            src={logoSrc}
            alt="WyseTime"
            style={compact ? styles.brandLogoCompact : styles.brandLogo}
          />
        </div>
        <span style={styles.titleDivider} />
        <span style={styles.title}>{title}</span>
      </div>

      <div style={styles.statusPill}>
        <StatusDot online size={9} />
        <span style={styles.statusText}>SYSTEM ONLINE</span>
        <div style={styles.divider} />
        <span style={styles.fps}>28 FPS</span>
      </div>

      <div style={styles.datetime}>
        <span style={styles.dayName}>{dayName}</span>
        <span style={styles.dot}>|</span>
        <span style={styles.dateNum}>{date}</span>
        <span style={styles.monthText}>{month}</span>
        <span style={styles.yearText}>{year}</span>
        <span style={styles.timeText}>{time}</span>
      </div>
    </header>
  )
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '52px',
    flexShrink: 0,
    backgroundColor: '#0a0a0a',
    borderBottom: '3px solid #0f0f0f',
    borderLeft: '2px solid #0f0f0f',
    paddingLeft: '22px',
    paddingRight: '20px',
    gap: '12px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    minWidth: 0,
    flex: 1,
  },
  brandBlock: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandLogo: {
    display: 'block',
    height: '32px',
    width: 'auto',
  },
  brandLogoCompact: {
    display: 'block',
    height: '24px',
    width: 'auto',
  },
  titleDivider: {
    width: '1px',
    height: '24px',
    backgroundColor: '#212121',
    flexShrink: 0,
  },
  title: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#626261',
    letterSpacing: '0.06em',
    minWidth: 0,
  },
  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#161717',
    border: '1px solid #1b1b1b',
    borderRadius: '4px',
    padding: '0 12px',
    height: '30px',
    flexShrink: 0,
  },
  statusText: {
    fontSize: '10px',
    color: '#7b7c7b',
    letterSpacing: '0.04em',
  },
  divider: {
    width: '1px',
    height: '10px',
    backgroundColor: '#2a2a2a',
  },
  fps: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#949794',
    letterSpacing: '0.03em',
  },
  datetime: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    marginLeft: '8px',
    flexShrink: 0,
  },
  dayName: {
    fontSize: '9px',
    fontWeight: 300,
    color: '#484849',
    letterSpacing: '0.05em',
  },
  dot: {
    fontSize: '10px',
    color: '#3a3a3a',
  },
  dateNum: {
    fontSize: '11px',
    fontWeight: 400,
    color: '#4d4d4d',
  },
  monthText: {
    fontSize: '10px',
    fontWeight: 300,
    color: '#4f5352',
    letterSpacing: '0.04em',
  },
  yearText: {
    fontSize: '11px',
    color: '#4f5252',
  },
  timeText: {
    fontSize: '12px',
    fontWeight: 400,
    color: '#828381',
    fontVariantNumeric: 'tabular-nums',
    marginLeft: '4px',
  },
}
