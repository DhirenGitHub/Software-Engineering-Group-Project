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

async function registerWithDetectionServer(id, sourceUrl) {
  const res = await fetch(`${DETECTION_SERVER}/cameras`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, source: sourceUrl }),
  })
  if (!res.ok) throw new Error(`server ${res.status}`)
  return await res.json() // { id, stream, capture }
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('camera-feeds')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  const { cameras, addCamera, updateCamera, removeCamera } = useCameras()

  const openAdd  = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit = (cam) => { setEditTarget(cam); setModalOpen(true) }

  const handleRemove = (cam) => {
    removeCamera(cam.id)
    // Best-effort deregister from detection server
    fetch(`${DETECTION_SERVER}/cameras/${cam.id}`, { method: 'DELETE' }).catch(() => {})
  }

  const handleSave = async (config) => {
    if (editTarget) {
      updateCamera(editTarget.id, config)
      return
    }

    const id = `CAM${String(cameras.length + 1).padStart(2, '0')}`

    // For URL-based sources, route through detection server for annotated stream
    if (config.sourceUrl && config.sourceType !== 'device') {
      try {
        const data = await registerWithDetectionServer(id, config.sourceUrl)
        addCamera({
          ...config, id,
          sourceUrl: data.stream, sourceType: 'mjpeg_http',
          rawUrl: config.sourceUrl, rawSourceType: config.sourceType,
        })
        return
      } catch {
        // Detection server not running — add with raw URL as fallback
      }
    }

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
