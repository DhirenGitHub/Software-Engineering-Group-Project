import { useEffect, useState } from 'react'
import { Cpu, Database, FolderOpen, Save, Search, Server } from 'lucide-react'
import PageLayout from '../components/layout/PageLayout'
import SettingsSidebar from '../components/settings/SettingsSidebar'
import CameraConfigRow from '../components/settings/CameraConfigRow'
import AddCameraModal from '../components/settings/AddCameraModal'
import Button from '../components/ui/Button'
import { useCameras } from '../context/CameraContext'
import { settingsNavItems } from '../data/mockData'
import useViewportWidth from '../hooks/useViewportWidth'
import { DETECTION_SERVER } from '../lib/detectionServer'

export default function SettingsPage() {
  const viewportWidth = useViewportWidth()
  const compact = viewportWidth < 1180
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
      <div style={compact ? styles.pageCompact : styles.page}>
        <SettingsSidebar
          items={settingsNavItems}
          active={activeSection}
          onSelect={setActiveSection}
          compact={compact}
        />

        <div style={compact ? styles.panelCompact : styles.panel}>
          {activeSection === 'camera-feeds' ? (
            <CameraFeedsConfig cameras={cameras} onAdd={openAdd} onEdit={openEdit} onRemove={handleRemove} compact={compact} />
          ) : activeSection === 'analytics-engine' ? (
            <AnalyticsEngineConfig compact={compact} />
          ) : activeSection === 'chromadb-status' ? (
            <ChromaSearchStatusConfig compact={compact} />
          ) : (
            <AlertRulesConfig compact={compact} />
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

function AnalyticsEngineConfig({ compact = false }) {
  const [status, setStatus] = useState('loading')
  const [form, setForm] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadConfig = async () => {
      try {
        const response = await fetch(`${DETECTION_SERVER}/analytics/config`)
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to load analytics engine settings.')
        }

        if (!cancelled) {
          setForm(payload)
          setStatus('ready')
          setMessage('')
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error')
          setMessage(error.message || 'Analytics engine settings are unavailable.')
        }
      }
    }

    loadConfig()
    return () => {
      cancelled = true
    }
  }, [])

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleApply = async () => {
    if (!form) return

    setStatus('saving')
    setMessage('')

    try {
      const response = await fetch(`${DETECTION_SERVER}/analytics/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detection_confidence: Number(form.detection_confidence),
          nms_iou: Number(form.nms_iou),
          crowd_threshold: Number(form.crowd_threshold),
          offline_after_seconds: Number(form.offline_after_seconds),
          default_model: form.default_model,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to apply analytics engine settings.')
      }

      setForm(payload)
      setStatus('ready')
      setMessage('Analytics engine settings applied.')
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Unable to save analytics engine settings.')
    }
  }

  if (!form && status === 'loading') {
    return (
      <div style={styles.configPanel}>
        <div style={styles.configHeader}>
          <div style={styles.configTitles}>
            <span style={styles.configTitle}>Analytics Engine</span>
            <span style={styles.configSubtitle}>Loading backend tuning controls</span>
          </div>
        </div>
        <div style={styles.divider} />
      </div>
    )
  }

  if (!form) {
    return (
      <div style={styles.configPanel}>
        <div style={styles.configHeader}>
          <div style={styles.configTitles}>
            <span style={styles.configTitle}>Analytics Engine</span>
            <span style={styles.configSubtitle}>Backend tuning controls are unavailable</span>
          </div>
        </div>
        <div style={styles.divider} />
        <div style={styles.inlineNotice}>{message || 'Start the detection server to configure the analytics engine.'}</div>
      </div>
    )
  }

  return (
    <div style={compact ? styles.configPanelCompact : styles.configPanel}>
      <div style={styles.configHeader}>
        <div style={styles.configTitles}>
          <span style={styles.configTitle}>DeepStream / YOLO Configuration</span>
          <span style={styles.configSubtitle}>Adjust inference thresholds and default backend behaviour</span>
        </div>
        <Button variant="secondary" size="md" onClick={handleApply} style={styles.applyButton}>
          <Save size={13} color="#bdbdbc" strokeWidth={1.8} />
          <span>{status === 'saving' ? 'Applying...' : 'Apply Changes'}</span>
        </Button>
      </div>
      <div style={styles.divider} />

      <div style={compact ? styles.analyticsGridCompact : styles.analyticsGrid}>
        <div style={styles.analyticsColumn}>
          <SliderField
            label="Detection Confidence Threshold"
            min={0.1}
            max={0.95}
            step={0.01}
            value={Number(form.detection_confidence || 0.4)}
            display={Number(form.detection_confidence || 0.4).toFixed(2)}
            onChange={(value) => updateField('detection_confidence', value)}
          />
          <SliderField
            label="NMS IOU Threshold"
            min={0.1}
            max={0.95}
            step={0.01}
            value={Number(form.nms_iou || 0.45)}
            display={Number(form.nms_iou || 0.45).toFixed(2)}
            onChange={(value) => updateField('nms_iou', value)}
          />
          <SliderField
            label="Crowd Alert Threshold"
            min={1}
            max={12}
            step={1}
            value={Number(form.crowd_threshold || 4)}
            display={`${Math.round(Number(form.crowd_threshold || 4))} people`}
            onChange={(value) => updateField('crowd_threshold', value)}
          />
          <SliderField
            label="Feed Timeout Window"
            min={3}
            max={30}
            step={1}
            value={Number(form.offline_after_seconds || 8)}
            display={`${Math.round(Number(form.offline_after_seconds || 8))}s`}
            onChange={(value) => updateField('offline_after_seconds', value)}
          />
        </div>

        <div style={styles.analyticsColumn}>
          <SelectField
            label="Default Detection Mode"
            value={form.default_model || 'person'}
            options={Array.isArray(form.availableModels) ? form.availableModels : []}
            onChange={(value) => updateField('default_model', value)}
          />
          <ReadonlyField
            label="Compute Device"
            value={form.computeDevice || 'CPU'}
          />
          <ReadonlyField
            label="Search Backend"
            value={form.searchBackend || 'ChromaDB'}
          />
          <ReadonlyField
            label="Active Detection Feeds"
            value={String(form.activeCameraCount || 0)}
          />
        </div>
      </div>

      <div style={compact ? styles.analyticsFooterCompact : styles.analyticsFooter}>
        <InfoStat label="Search Engine" value={form.searchReady ? 'Ready' : 'Standby'} />
        <InfoStat label="Default Profile" value={getModelLabel(form.default_model)} />
        <InfoStat label="Crowd Limit" value={`${Math.round(Number(form.crowd_threshold || 0))} people`} />
      </div>

      {message && (
        <div style={status === 'error' ? styles.inlineNoticeError : styles.inlineNotice}>
          {message}
        </div>
      )}
    </div>
  )
}

function ChromaSearchStatusConfig({ compact = false }) {
  const [status, setStatus] = useState({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false

    const loadStatus = async () => {
      try {
        const response = await fetch(`${DETECTION_SERVER}/search/status`)
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.detail || payload?.error || 'Unable to load ChromaDB search status.')
        }

        if (!cancelled) {
          setStatus({
            phase: 'ready',
            data: payload,
            updatedAt: Date.now(),
          })
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            phase: 'error',
            message: error.message || 'Detection server is unavailable.',
          })
        }
      }
    }

    loadStatus()
    const pollId = window.setInterval(loadStatus, 4000)

    return () => {
      cancelled = true
      window.clearInterval(pollId)
    }
  }, [])

  const data = status.data ?? {}
  const backendOnline = status.phase === 'ready'

  let engineState = 'Checking'
  let engineTone = 'neutral'
  let engineMessage = 'Loading live smart search status from the detection server.'

  if (status.phase === 'error') {
    engineState = 'Offline'
    engineTone = 'high'
    engineMessage = 'Start `python server/app.py` to inspect the ChromaDB index from Settings.'
  } else if (data.ready) {
    engineState = 'Ready'
    engineTone = 'good'
    engineMessage = data.indexed_items > 0
      ? 'Smart Search is online and the dashboard can query the ChromaDB index right now.'
      : 'Smart Search is online. Person crops will appear here as soon as live detections are indexed.'
  } else if (data.error) {
    engineState = 'Unavailable'
    engineTone = 'high'
    engineMessage = data.error
  } else if ((data.cameraCount || 0) > 0) {
    engineState = 'Standby'
    engineTone = 'medium'
    engineMessage = 'The backend is live and waiting for fresh person detections before building the searchable index.'
  } else {
    engineState = 'Idle'
    engineTone = 'neutral'
    engineMessage = 'No active camera feeds are registered yet, so the ChromaDB index has not started filling.'
  }

  const updatedLabel = status.updatedAt
    ? new Date(status.updatedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    : '--:--:--'

  return (
    <div style={compact ? styles.configPanelCompact : styles.configPanel}>
      <div style={styles.configHeader}>
        <div style={styles.configTitles}>
          <span style={styles.configTitle}>ChromaDB Smart Search</span>
          <span style={styles.configSubtitle}>Live backend status for the dashboard&apos;s text-based person search</span>
        </div>
      </div>
      <div style={styles.divider} />

      <div style={styles.statusHero}>
        <div style={styles.statusHeroTop}>
          <div style={styles.heroLabelWrap}>
            <Search size={14} color="#d5d5d5" strokeWidth={1.6} />
            <span style={styles.heroLabel}>SMART SEARCH ENGINE</span>
          </div>
          <StatusChip label={engineState} tone={engineTone} />
        </div>
        <span style={styles.heroText}>{engineMessage}</span>
      </div>

      <div style={styles.statusGrid}>
        <StatusCard
          icon={<Database size={15} color="#d3d4d2" strokeWidth={1.6} />}
          label="Database"
          value={data.database || 'ChromaDB'}
          detail={data.collection ? `Collection: ${data.collection}` : 'Persistent vector store'}
        />
        <StatusCard
          icon={<Server size={15} color="#d3d4d2" strokeWidth={1.6} />}
          label="Backend"
          value={backendOnline ? 'Live' : 'Offline'}
          detail={backendOnline
            ? `${data.cameraCount || 0} active feed${data.cameraCount === 1 ? '' : 's'} registered`
            : 'No response from detection server'}
        />
        <StatusCard
          icon={<Search size={15} color="#d3d4d2" strokeWidth={1.6} />}
          label="Indexed Items"
          value={backendOnline ? String(data.indexed_items || 0) : '--'}
          detail={backendOnline
            ? `${data.queued_items || 0} pending embeddings`
            : 'Index count unavailable while offline'}
        />
        <StatusCard
          icon={<FolderOpen size={15} color="#d3d4d2" strokeWidth={1.6} />}
          label="Storage"
          value={data.persist_dir || 'server/chroma_db'}
          detail={data.storage_mode === 'ephemeral'
            ? 'Session-only index with crops still saved locally'
            : data.crops_dir ? `Crops: ${data.crops_dir}` : 'Search crops saved on disk'}
        />
      </div>

      <div style={styles.infoPanel}>
        <div style={styles.infoRow}>
          <span style={styles.infoKey}>Model</span>
          <span style={styles.infoValue}>{data.model_id || 'openai/clip-vit-base-patch32'}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoKey}>Device</span>
          <span style={styles.infoValue}>{data.device || 'Not initialised yet'}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoKey}>Search Endpoint</span>
          <span style={styles.infoValue}>{backendOnline ? data.searchEndpoint || '/search' : '--'}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoKey}>Last Refresh</span>
          <span style={styles.infoValue}>{updatedLabel}</span>
        </div>
      </div>
    </div>
  )
}

function CameraFeedsConfig({ cameras, onAdd, onEdit, onRemove, compact = false }) {
  return (
    <div style={compact ? styles.configPanelCompact : styles.configPanel}>
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

function StatusCard({ icon, label, value, detail }) {
  return (
    <article style={styles.statusCard}>
      <div style={styles.statusCardHead}>
        <span style={styles.statusIcon}>{icon}</span>
        <span style={styles.statusCardLabel}>{label}</span>
      </div>
      <span style={styles.statusCardValue}>{value}</span>
      <span style={styles.statusCardDetail}>{detail}</span>
    </article>
  )
}

function StatusChip({ label, tone }) {
  const toneStyle = tone === 'good'
    ? styles.statusChipGood
    : tone === 'medium'
      ? styles.statusChipMedium
      : tone === 'high'
        ? styles.statusChipHigh
        : styles.statusChipNeutral

  return <span style={{ ...styles.statusChip, ...toneStyle }}>{label}</span>
}

function SliderField({ label, value, min, max, step, display, onChange }) {
  const percent = ((value - min) / (max - min)) * 100

  return (
    <div style={styles.sliderField}>
      <div style={styles.sliderHead}>
        <span style={styles.sliderLabel}>{label}</span>
        <span style={styles.sliderValue}>{display}</span>
      </div>
      <div style={styles.sliderTrackWrap}>
        <div style={styles.sliderTrack}>
          <div style={{ ...styles.sliderTrackFill, width: `${Math.max(0, Math.min(100, percent))}%` }} />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          style={styles.rangeInput}
        />
      </div>
    </div>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div style={styles.controlField}>
      <span style={styles.controlLabel}>{label}</span>
      <div style={styles.selectWrapper}>
        <select value={value} onChange={(event) => onChange(event.target.value)} style={styles.engineSelect}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function ReadonlyField({ label, value }) {
  return (
    <div style={styles.controlField}>
      <span style={styles.controlLabel}>{label}</span>
      <div style={styles.readonlyBox}>
        {value}
      </div>
    </div>
  )
}

function InfoStat({ label, value }) {
  return (
    <div style={styles.infoStat}>
      <span style={styles.infoStatLabel}>{label}</span>
      <span style={styles.infoStatValue}>{value}</span>
    </div>
  )
}

function getModelLabel(model) {
  if (model === 'both') return 'Person + Phone'
  if (model === 'phone') return 'Phone Only'
  return 'Person Only'
}

function AlertRulesConfig({ compact = false }) {
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
  ]

  return (
    <div style={compact ? styles.configPanelCompact : styles.configPanel}>
      <div style={styles.configHeader}>
        <div style={styles.configTitles}>
          <span style={styles.configTitle}>Alert Rules</span>
          <span style={styles.configSubtitle}>Current live severity mapping used by the alerts feed</span>
        </div>
      </div>
      <div style={styles.divider} />

      <div style={styles.rulesIntro}>
        <span style={styles.rulesHeading}>Live Alert Mapping</span>
        <span style={styles.rulesText}>
          These are the live alert categories currently raised by the detection backend and shown on the operator dashboard.
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
  pageCompact: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  panel: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  panelCompact: { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' },
  configPanel: {
    flex: 1, display: 'flex', flexDirection: 'column',
    padding: '24px', overflow: 'hidden',
    backgroundColor: '#090a0a', margin: '12px',
    borderRadius: '7px', border: '2px solid #171717',
  },
  configPanelCompact: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '18px',
    overflow: 'visible',
    backgroundColor: '#090a0a',
    margin: '0 12px 12px',
    borderRadius: '7px',
    border: '2px solid #171717',
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
  applyButton: {
    minWidth: '142px',
    justifyContent: 'center',
    backgroundColor: '#151515',
    border: '1px solid #343434',
    color: '#d3d4d2',
  },
  analyticsGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 1fr)',
    gap: '28px',
    marginBottom: '18px',
  },
  analyticsGridCompact: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '22px',
    marginBottom: '18px',
  },
  analyticsColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
  },
  sliderField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sliderHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  sliderLabel: {
    fontSize: '13px',
    color: '#8f908e',
  },
  sliderValue: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#6f706e',
    fontVariantNumeric: 'tabular-nums',
  },
  sliderTrackWrap: {
    position: 'relative',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
  },
  sliderTrack: {
    width: '100%',
    height: '6px',
    borderRadius: '999px',
    backgroundColor: '#171717',
    overflow: 'hidden',
  },
  sliderTrackFill: {
    height: '100%',
    backgroundColor: '#ff1f1f',
    borderRadius: '999px',
  },
  rangeInput: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  controlField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  controlLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#7f807e',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  engineSelect: {
    width: '100%',
    height: '40px',
    padding: '0 12px',
    borderRadius: '4px',
    border: '1px solid #1e1e1e',
    backgroundColor: '#0d0d0d',
    color: '#7f807e',
    fontSize: '13px',
    outline: 'none',
  },
  readonlyBox: {
    display: 'flex',
    alignItems: 'center',
    minHeight: '40px',
    padding: '0 12px',
    borderRadius: '4px',
    border: '1px solid #1e1e1e',
    backgroundColor: '#0d0d0d',
    color: '#767775',
    fontSize: '13px',
  },
  analyticsFooter: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
    marginTop: 'auto',
  },
  analyticsFooterCompact: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '12px',
    marginTop: '6px',
  },
  infoStat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px 14px',
    borderRadius: '8px',
    backgroundColor: '#0d0d0d',
    border: '1px solid #171717',
  },
  infoStatLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#5f605e',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  infoStatValue: {
    fontSize: '13px',
    color: '#b4b5b3',
  },
  inlineNotice: {
    marginTop: '14px',
    padding: '12px 14px',
    borderRadius: '8px',
    backgroundColor: '#0f0f0f',
    border: '1px solid #171717',
    fontSize: '12px',
    color: '#838482',
  },
  inlineNoticeError: {
    marginTop: '14px',
    padding: '12px 14px',
    borderRadius: '8px',
    backgroundColor: '#1a1010',
    border: '1px solid #4b2020',
    fontSize: '12px',
    color: '#f29089',
  },
  statusHero: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '18px',
    padding: '18px',
    borderRadius: '10px',
    backgroundColor: '#0d0d0d',
    border: '1px solid #171717',
  },
  statusHeroTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  heroLabelWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  heroLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#d3d4d2',
    letterSpacing: '0.08em',
  },
  heroText: {
    fontSize: '12px',
    color: '#727371',
    lineHeight: 1.7,
    maxWidth: '850px',
  },
  statusChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  statusChipGood: {
    backgroundColor: '#112016',
    color: '#72d48a',
    border: '1px solid #22492d',
  },
  statusChipMedium: {
    backgroundColor: '#2b2210',
    color: '#e0bf72',
    border: '1px solid #5a4720',
  },
  statusChipHigh: {
    backgroundColor: '#2b1111',
    color: '#ff8a82',
    border: '1px solid #5d2020',
  },
  statusChipNeutral: {
    backgroundColor: '#171717',
    color: '#8d8e8c',
    border: '1px solid #252525',
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    marginBottom: '18px',
  },
  statusCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '16px',
    borderRadius: '10px',
    backgroundColor: '#101010',
    border: '1px solid #1a1a1a',
    minHeight: '146px',
  },
  statusCardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  statusIcon: {
    width: '28px',
    height: '28px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '7px',
    backgroundColor: '#151515',
    border: '1px solid #232323',
    flexShrink: 0,
  },
  statusCardLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#8e8f8d',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  statusCardValue: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#d3d4d2',
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
  },
  statusCardDetail: {
    fontSize: '12px',
    color: '#666765',
    lineHeight: 1.6,
  },
  infoPanel: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '10px',
    padding: '14px 16px',
    borderRadius: '10px',
    backgroundColor: '#0c0c0c',
    border: '1px solid #171717',
  },
  infoRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  infoKey: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#7c7d7b',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: '12px',
    color: '#b4b5b3',
    lineHeight: 1.6,
    overflowWrap: 'anywhere',
  },
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
