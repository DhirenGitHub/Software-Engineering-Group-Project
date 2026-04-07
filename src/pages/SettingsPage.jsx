import { useState } from 'react'
import PageLayout from '../components/layout/PageLayout'
import SettingsSidebar from '../components/settings/SettingsSidebar'
import CameraConfigRow from '../components/settings/CameraConfigRow'
import PlaceholderConfig from '../components/settings/PlaceholderConfig'
import AddCameraModal from '../components/settings/AddCameraModal'
import Button from '../components/ui/Button'
import { useCameras } from '../context/CameraContext'
import { settingsNavItems } from '../data/mockData'

const DETECTION_SERVER = 'http://localhost:5000'

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('camera-feeds')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  const { cameras, addCamera, updateCamera, removeCamera } = useCameras()

  const openAdd  = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit = (cam) => { setEditTarget(cam); setModalOpen(true) }

  const handleRemove = (cam) => {
    removeCamera(cam.id)
    // properly cleanly deregister from detection server so cv2 releases webcams
    const backendId = cam.backendId || cam.id
    fetch(`${DETECTION_SERVER}/cameras/${backendId}`, { method: 'DELETE' }).catch(() => {})
  }

  const handleSave = async (config) => {
    if (editTarget) {
      updateCamera(editTarget.id, config)
      return
    }

    const id = `CAM${String(cameras.length + 1).padStart(2, '0')}`
    
    // config already contains backendId, stream URLs, etc. from AddCameraModal
    addCamera({ ...config, id })
  }

  return (
    <PageLayout title="SYSTEM CONFIGURATION">
      <div style={styles.page}>
        <SettingsSidebar
          items={settingsNavItems}
          active={activeSection}
          onSelect={setActiveSection}
        />

        <div style={styles.panel}>
          {activeSection === 'camera-feeds' ? (
            <CameraFeedsConfig cameras={cameras} onAdd={openAdd} onEdit={openEdit} onRemove={handleRemove} />
          ) : (
            <PlaceholderConfig
              title={settingsNavItems.find((i) => i.id === activeSection)?.label ?? ''}
            />
          )}
        </div>
      </div>

      <AddCameraModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editTarget}
      />
    </PageLayout>
  )
}

function CameraFeedsConfig({ cameras, onAdd, onEdit, onRemove }) {
  return (
    <div style={styles.configPanel}>
      <div style={styles.configHeader}>
        <div style={styles.configTitles}>
          <span style={styles.configTitle}>Camera Feed Configuration</span>
          <span style={styles.configSubtitle}>Manage RTSP streams and AI processing nodes</span>
        </div>
        <Button variant="primary" size="md" onClick={onAdd}>Add Camera</Button>
      </div>
      <div style={styles.divider} />
      <div style={styles.cameraList}>
        {cameras.length === 0 ? (
          <div style={styles.noCamera}>
            <span style={styles.noCameraText}>No cameras configured yet.</span>
            <span style={styles.noCameraHint}>Click "Add Camera" to get started.</span>
          </div>
        ) : (
          cameras.map((cam) => (
            <CameraConfigRow key={cam.id} camera={cam} onConfigure={() => onEdit(cam)} onRemove={() => onRemove(cam)} />
          ))
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { display: 'flex', height: '100%', overflow: 'hidden' },
  panel: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  configPanel: {
    flex: 1, display: 'flex', flexDirection: 'column',
    padding: '24px', overflow: 'hidden',
    backgroundColor: '#090a0a', margin: '12px',
    borderRadius: '7px', border: '2px solid #171717',
  },
  configHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' },
  configTitles: { display: 'flex', flexDirection: 'column', gap: '4px' },
  configTitle: { fontSize: '16px', fontWeight: 700, color: '#9fa09e', letterSpacing: '0.01em' },
  configSubtitle: { fontSize: '11px', fontWeight: 400, color: '#3c3d3c' },
  divider: { height: '1px', backgroundColor: '#141414', marginBottom: '16px', flexShrink: 0 },
  cameraList: { display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, gap: '2px' },
  noCamera: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '6px' },
  noCameraText: { fontSize: '12px', color: '#2e2f2e', fontWeight: 700 },
  noCameraHint: { fontSize: '10px', color: '#242424' },
}
