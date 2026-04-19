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
          ) : activeSection === 'alert-rules' ? (
            <AlertRulesConfig />
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

function AlertRulesConfig() {
  const rules = [
    {
      title: 'Phone Detection',
      priority: 'Medium Priority',
      tone: 'medium',
      category: 'Device Misuse',
      detail: 'Raised when one or more phones are detected on a live feed.',
    },
    {
      title: 'Crowd Threshold',
      priority: 'Medium Priority',
      tone: 'medium',
      category: 'Crowd Monitoring',
      detail: 'Raised when the current person count reaches the configured crowd threshold.',
    },
    {
      title: 'Feed Timeout',
      priority: 'Low Priority',
      tone: 'low',
      category: 'Feed Health',
      detail: 'Raised when the detector stops receiving fresh frames for a configured period.',
    },
    {
      title: 'Reserved High Severity',
      priority: 'High Priority',
      tone: 'high',
      category: 'Future Risk Rules',
      detail: 'High severity is intentionally reserved for future loitering, intrusion, or suspicious-movement rules.',
    },
  ]

  return (
    <div style={styles.configPanel}>
      <div style={styles.configHeader}>
        <div style={styles.configTitles}>
          <span style={styles.configTitle}>Alert Rules</span>
          <span style={styles.configSubtitle}>Current live severity mapping used by the alerts feed</span>
        </div>
      </div>
      <div style={styles.divider} />

      <div style={styles.rulesIntro}>
        <span style={styles.rulesHeading}>Rule Priorities</span>
        <span style={styles.rulesText}>
          Acknowledging an alert closes it from the active list. Phone events are medium priority, feed health stays low, and high priority is reserved for more suspicious behavior when those rules are added later.
        </span>
      </div>

      <div style={styles.rulesGrid}>
        {rules.map((rule) => (
          <article key={rule.title} style={styles.ruleCard}>
            <div style={styles.ruleHeader}>
              <span style={styles.ruleTitle}>{rule.title}</span>
              <span style={{
                ...styles.rulePriority,
                ...(rule.tone === 'high'
                  ? styles.rulePriorityHigh
                  : rule.tone === 'medium'
                    ? styles.rulePriorityMedium
                    : styles.rulePriorityLow),
              }}>
                {rule.priority}
              </span>
            </div>
            <span style={styles.ruleCategory}>{rule.category}</span>
            <span style={styles.ruleDetail}>{rule.detail}</span>
          </article>
        ))}
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
  rulesIntro: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '18px',
    padding: '14px 16px',
    borderRadius: '8px',
    backgroundColor: '#0d0d0d',
    border: '1px solid #171717',
  },
  rulesHeading: { fontSize: '12px', fontWeight: 700, color: '#a9aaa8', letterSpacing: '0.04em' },
  rulesText: { fontSize: '12px', color: '#666765', lineHeight: 1.6, maxWidth: '820px' },
  rulesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '14px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  ruleCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '16px',
    borderRadius: '10px',
    backgroundColor: '#101010',
    border: '1px solid #1a1a1a',
    minHeight: '150px',
  },
  ruleHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  ruleTitle: { fontSize: '14px', fontWeight: 700, color: '#d3d4d2' },
  rulePriority: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 9px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  rulePriorityHigh: {
    backgroundColor: '#2b1111',
    color: '#ff8a82',
    border: '1px solid #5d2020',
  },
  rulePriorityMedium: {
    backgroundColor: '#2b2210',
    color: '#e0bf72',
    border: '1px solid #5a4720',
  },
  rulePriorityLow: {
    backgroundColor: '#141d2f',
    color: '#93a8ff',
    border: '1px solid #30426f',
  },
  ruleCategory: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#8f8f8f',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  ruleDetail: { fontSize: '12px', color: '#6a6b69', lineHeight: 1.6 },
}
