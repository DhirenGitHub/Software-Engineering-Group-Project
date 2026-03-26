import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/layout/PageLayout'
import CameraGrid from '../components/dashboard/CameraGrid'
import AlertsPanel from '../components/dashboard/AlertsPanel'
import ZoneAnalytics from '../components/dashboard/ZoneAnalytics'
import FootfallChart from '../components/dashboard/FootfallChart'
import AddCameraModal from '../components/settings/AddCameraModal'
import { useCameras } from '../context/CameraContext'
import { alerts, zoneAnalytics, footfallData } from '../data/mockData'
import { Settings, Cpu } from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { cameras, addCamera } = useCameras()
  const [modalOpen, setModalOpen] = useState(false)
  const [detectionOn, setDetectionOn] = useState(true)

  return (
    <PageLayout title="LIVE DASHBOARD">
      <div style={styles.body}>
        <div style={styles.grid}>
          <CameraGrid cameras={cameras} onAddCamera={() => setModalOpen(true)} detectionOn={detectionOn} />
        </div>

        <aside style={styles.sidebar}>
          <AlertsPanel alerts={alerts} />
          <ZoneAnalytics data={zoneAnalytics} />
          <FootfallChart data={footfallData} />
          <FeedControls detectionOn={detectionOn} onToggle={() => setDetectionOn((v) => !v)} />
          <button style={styles.settingsBtn} onClick={() => navigate('/settings')}>
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
    <div style={fc.panel}>
      <div style={fc.header}>
        <Cpu size={12} color="#626261" strokeWidth={1.5} />
        <span style={fc.title}>FEED CONTROLS</span>
      </div>
      <div style={fc.row}>
        <div style={fc.rowLeft}>
          <span style={fc.label}>AI Detection</span>
          <span style={fc.hint}>{detectionOn ? 'Showing annotated feed' : 'Showing raw feed'}</span>
        </div>
        <button onClick={onToggle} style={{ ...fc.toggle, ...(detectionOn ? fc.toggleOn : fc.toggleOff) }}>
          <div style={{ ...fc.thumb, ...(detectionOn ? fc.thumbOn : fc.thumbOff) }} />
        </button>
      </div>
    </div>
  )
}

const fc = {
  panel: { borderTop: '1px solid #141414', padding: '10px 12px', flexShrink: 0 },
  header: { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' },
  title: { fontSize: '10px', fontWeight: 700, color: '#626261', letterSpacing: '0.06em' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { display: 'flex', flexDirection: 'column', gap: '2px' },
  label: { fontSize: '11px', fontWeight: 600, color: '#7a7b7a' },
  hint: { fontSize: '9px', color: '#3c3d3c' },
  toggle: {
    width: '36px', height: '20px', borderRadius: '10px',
    border: 'none', cursor: 'pointer', position: 'relative',
    transition: 'background-color 0.2s', flexShrink: 0,
  },
  toggleOn: { backgroundColor: '#d52521' },
  toggleOff: { backgroundColor: '#1e1e1e' },
  thumb: {
    position: 'absolute', top: '3px',
    width: '14px', height: '14px',
    borderRadius: '50%', backgroundColor: '#fff',
    transition: 'left 0.2s',
  },
  thumbOn:  { left: '19px' },
  thumbOff: { left: '3px' },
}

const styles = {
  body: { display: 'flex', height: '100%', overflow: 'hidden' },
  grid: { flex: 1, minWidth: 0, overflow: 'hidden' },
  sidebar: {
    width: '320px', flexShrink: 0,
    borderLeft: '1px solid #141414',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden', backgroundColor: '#080808',
  },
  settingsBtn: {
    width: '100%', padding: '12px',
    borderTop: '1px solid #141414',
    backgroundColor: 'transparent', cursor: 'pointer', marginTop: 'auto', flexShrink: 0,
  },
  settingsBtnInner: {
    display: 'flex', alignItems: 'center', gap: '10px',
    backgroundColor: '#0d0d0d', border: '1px solid #1b1b1b',
    borderRadius: '4px', padding: '12px 14px', width: '100%',
  },
  settingsBtnText: { fontSize: '11px', fontWeight: 700, color: '#626261', letterSpacing: '0.05em' },
}
