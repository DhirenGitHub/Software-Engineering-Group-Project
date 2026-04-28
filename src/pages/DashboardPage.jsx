import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cpu, Settings } from 'lucide-react'
import PageLayout from '../components/layout/PageLayout'
import CameraGrid from '../components/dashboard/CameraGrid'
import AlertsPanel from '../components/dashboard/AlertsPanelLive'
import ZoneAnalytics from '../components/dashboard/ZoneAnalytics'
import FootfallChart from '../components/dashboard/FootfallChart'
import SearchPanel from '../components/dashboard/SearchPanel'
import AddCameraModal from '../components/settings/AddCameraModal'
import { useCameras } from '../context/CameraContext'
import useLiveAlerts from '../hooks/useLiveAlerts'
import useAnalyticsHistory from '../hooks/useAnalyticsHistory'
import useViewportWidth from '../hooks/useViewportWidth'

export default function DashboardPage() {
  const navigate = useNavigate()
  const viewportWidth = useViewportWidth()
  const compact = viewportWidth < 900
  const { cameras, addCamera } = useCameras()
  const { alerts, status: alertsStatus } = useLiveAlerts()
  const { history } = useAnalyticsHistory()
  const [modalOpen, setModalOpen] = useState(false)
  const [detectionOn, setDetectionOn] = useState(true)

  const zoneStats = useMemo(
    () => buildZoneStats(history, cameras.length, alerts),
    [alerts, cameras.length, history],
  )

  const footfallData = useMemo(
    () => buildFootfallTrendData(history),
    [history],
  )

  return (
    <PageLayout title="LIVE DASHBOARD">
      <div style={compact ? styles.bodyCompact : styles.body}>
        <div style={compact ? styles.gridCompact : styles.grid}>
          <CameraGrid cameras={cameras} onAddCamera={() => setModalOpen(true)} detectionOn={detectionOn} />
        </div>

        <aside style={compact ? styles.sidebarCompact : styles.sidebar}>
          <AlertsPanel alerts={alerts} status={alertsStatus} />
          <ZoneAnalytics stats={zoneStats} title="ZONE ANALYTICS" subtitle="(LIVE)" />
          <SearchPanel />
          <FootfallChart data={footfallData} />
          <FeedControls detectionOn={detectionOn} onToggle={() => setDetectionOn((value) => !value)} />
          <button style={styles.settingsBtn} onClick={() => navigate('/settings')} type="button">
            <div style={styles.settingsBtnInner}>
              <Settings size={14} color="#626261" strokeWidth={1.5} />
              <span style={styles.settingsBtnText}>SYSTEM CONFIGURATION</span>
            </div>
          </button>
        </aside>
      </div>

      <AddCameraModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={addCamera}
      />
    </PageLayout>
  )
}

function FeedControls({ detectionOn, onToggle }) {
  return (
    <div style={controls.panel}>
      <div style={controls.header}>
        <Cpu size={12} color="#626261" strokeWidth={1.5} />
        <span style={controls.title}>FEED CONTROLS</span>
      </div>
      <div style={controls.row}>
        <div style={controls.rowLeft}>
          <span style={controls.label}>AI Detection</span>
          <span style={controls.hint}>{detectionOn ? 'Showing annotated feed' : 'Showing raw feed'}</span>
        </div>
        <button type="button" onClick={onToggle} style={{ ...controls.toggle, ...(detectionOn ? controls.toggleOn : controls.toggleOff) }}>
          <div style={{ ...controls.thumb, ...(detectionOn ? controls.thumbOn : controls.thumbOff) }} />
        </button>
      </div>
    </div>
  )
}

function buildZoneStats(history, cameraCount, alerts) {
  const latestSample = history[history.length - 1] || { totalPeople: 0, totalPhones: 0 }
  const openAlerts = alerts.filter((alert) => alert.status !== 'resolved').length

  return [
    { key: 'PEOPLE', value: String(latestSample.totalPeople || 0) },
    { key: 'PHONES', value: String(latestSample.totalPhones || 0) },
    { key: 'ALERTS', value: String(openAlerts || 0) },
    { key: 'FEEDS', value: String(cameraCount || 0) },
  ]
}

function buildFootfallTrendData(history) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const previousByCamera = new Map()
  const totals = new Map(days.map((day) => [day, 0]))

  history.forEach((sample) => {
    const day = days[(new Date(sample.timestamp).getDay() + 6) % 7]
    let delta = 0

    sample.cameras.forEach((camera) => {
      const previousCount = previousByCamera.get(camera.cameraId) ?? 0
      delta += Math.max(0, camera.personCount - previousCount)
      previousByCamera.set(camera.cameraId, camera.personCount)
    })

    totals.set(day, (totals.get(day) || 0) + (delta > 0 ? delta : sample.totalPeople || 0))
  })

  return days.map((day) => ({
    day,
    count: Math.round(totals.get(day) || 0),
  }))
}

const controls = {
  panel: {
    borderTop: '1px solid #141414',
    padding: '10px 12px',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    marginBottom: '10px',
  },
  title: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#626261',
    letterSpacing: '0.06em',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  rowLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#7a7b7a',
  },
  hint: {
    fontSize: '9px',
    color: '#3c3d3c',
  },
  toggle: {
    width: '36px',
    height: '20px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background-color 0.2s',
    flexShrink: 0,
  },
  toggleOn: {
    backgroundColor: '#d52521',
  },
  toggleOff: {
    backgroundColor: '#1e1e1e',
  },
  thumb: {
    position: 'absolute',
    top: '3px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'left 0.2s',
  },
  thumbOn: {
    left: '19px',
  },
  thumbOff: {
    left: '3px',
  },
}

const styles = {
  body: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
  },
  bodyCompact: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
  },
  gridCompact: {
    flex: '0 0 auto',
    minHeight: '45vh',
    overflow: 'hidden',
  },
  grid: {
    flex: '1 1 0%',
    minWidth: '280px',
    minHeight: '0',
    overflow: 'hidden',
  },
  sidebar: {
    width: '280px',
    maxWidth: '30%',
    flexShrink: 1,
    borderLeft: '1px solid #141414',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#080808',
  },
  sidebarCompact: {
    width: '100%',
    flexShrink: 0,
    borderTop: '1px solid #141414',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#080808',
    maxHeight: '45vh',
  },
  settingsBtn: {
    width: '100%',
    padding: '12px',
    borderTop: '1px solid #141414',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    marginTop: 'auto',
    flexShrink: 0,
  },
  settingsBtnInner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#0d0d0d',
    border: '1px solid #1b1b1b',
    borderRadius: '4px',
    padding: '12px 14px',
    width: '100%',
  },
  settingsBtnText: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#626261',
    letterSpacing: '0.05em',
  },
}
