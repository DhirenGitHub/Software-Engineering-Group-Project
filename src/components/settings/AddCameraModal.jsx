import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff, X } from 'lucide-react'
import Button from '../ui/Button'
import StatusDot from '../ui/StatusDot'
import { DETECTION_SERVER } from '../../lib/detectionServer'

const BACKEND_REGISTERED_SOURCE_TYPES = new Set(['rtsp', 'mjpeg_http', 'file', 'device'])

const SOURCE_TYPES = [
  { value: 'rtsp', label: 'RTSP Stream', description: 'Backend-proxied IP camera stream' },
  { value: 'mjpeg_http', label: 'MJPEG HTTP', description: 'HTTP camera stream with backend detection' },
  { value: 'file', label: 'Video File', description: 'Absolute Windows path or hosted .mp4 for testing' },
  { value: 'device', label: 'Webcam', description: 'Browser webcam piped into the backend detector' },
]

const URL_PLACEHOLDERS = {
  rtsp: 'rtsp://192.168.1.101/stream1',
  mjpeg_http: 'http://192.168.1.101/video',
  file: 'C:\\Users\\ASUS Vivobook\\OneDrive\\Desktop\\Software-Engineering-Group-Project\\videos\\sample.mp4',
  device: 'Leave blank for default webcam',
}

const URL_HINTS = {
  rtsp: 'The backend will open the RTSP stream and expose an annotated MJPEG feed to the dashboard.',
  mjpeg_http: 'Use the raw MJPEG camera URL. The backend will wrap it with live detection overlays.',
  file: 'Local video files are ideal for testing. Absolute Windows paths work here.',
  device: 'The browser will ask for camera permission. You can optionally paste a specific deviceId.',
}

function getDefaultTargetModel() {
  return 'person'
}

function buildEmptyForm() {
  return {
    name: '',
    location: '',
    sourceType: 'file',
    sourceUrl: '',
    targetModel: getDefaultTargetModel(),
    features: [],
  }
}

const EMPTY_FORM = buildEmptyForm()

export default function AddCameraModal({ open, onClose, onSave, initial = null }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [testState, setTestState] = useState('idle')
  const [testMessage, setTestMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!open) return

    if (initial) {
      const initialSourceType = SOURCE_TYPES.some((item) => item.value === (initial.rawSourceType || initial.sourceType))
        ? (initial.rawSourceType || initial.sourceType)
        : 'file'

      setForm({
        ...initial,
        sourceType: initialSourceType,
        sourceUrl: initial.rawUrl !== undefined ? initial.rawUrl : initial.sourceUrl,
        targetModel: initial.targetModel || getDefaultTargetModel(),
      })
    } else {
      setForm(buildEmptyForm())
    }

    setTestState('idle')
    setTestMessage('')
    setIsSaving(false)
  }, [open, initial])

  useEffect(() => {
    if (!open) return undefined

    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const isEdit = Boolean(initial)

  const handleSave = async () => {
    if (!form.name.trim()) return

    setIsSaving(true)
    setTestMessage('')

    let finalForm = {
      ...form,
      name: form.name.trim(),
      location: form.location.trim(),
      sourceUrl: form.sourceUrl.trim(),
    }

    try {
      if (BACKEND_REGISTERED_SOURCE_TYPES.has(finalForm.sourceType)) {
        if (initial?.backendId) {
          await fetch(`${DETECTION_SERVER}/cameras/${initial.backendId}`, { method: 'DELETE' }).catch(() => {})
        }

        const backendId = initial?.backendId || buildCameraId(finalForm.name)
        const backendSource = finalForm.sourceType === 'device'
          ? 'push'
          : finalForm.sourceUrl

        const response = await fetch(`${DETECTION_SERVER}/cameras`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: backendId,
            source: backendSource,
            model: finalForm.targetModel || getDefaultTargetModel(),
          }),
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to register this source with the detection backend.')
        }

        finalForm = {
          ...finalForm,
          sourceType: 'mjpeg_http',
          sourceUrl: payload.stream,
          rawSourceType: form.sourceType,
          rawUrl: form.sourceUrl.trim(),
          backendId,
        }
      }

      onSave(finalForm)
      onClose()
    } catch (error) {
      setTestState('fail')
      setTestMessage(error.message || 'Unable to save this camera.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    setTestState('testing')
    setTestMessage('')

    try {
      if (form.sourceType === 'device') {
        await testDeviceSource(form.sourceUrl.trim())
        setTestState('ok')
        setTestMessage('Webcam permission granted and a live stream is available.')
        return
      }

      if (!form.sourceUrl.trim()) {
        throw new Error('Enter a stream URL or video path first.')
      }

      const hasFrames = await testBackendSource({
        sourceType: form.sourceType,
        sourceUrl: form.sourceUrl.trim(),
        targetModel: form.targetModel || getDefaultTargetModel(),
      })

      if (!hasFrames) {
        throw new Error('The backend registered the source but did not receive frames in time.')
      }

      setTestState('ok')
      setTestMessage('Backend received frames successfully.')
    } catch (error) {
      setTestState('fail')
      setTestMessage(error.message || 'Connection test failed.')
    }
  }

  return (
    <>
      <div
        ref={overlayRef}
        onClick={(event) => {
          if (event.target === overlayRef.current) onClose()
        }}
        style={styles.backdrop}
      />

      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.title}>{isEdit ? `Configure ${initial.name}` : 'Add Camera'}</span>
            {isEdit && (
              <div style={styles.subtitle}>
                <span style={styles.subtitleText}>{initial.location || 'Configured feed'}</span>
                <StatusDot online size={7} />
                <span style={styles.subtitleText}>ACTIVE</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={styles.closeBtn} type="button">
            <X size={16} color="#636463" strokeWidth={1.5} />
          </button>
        </div>

        <div style={styles.divider} />

        <div style={styles.body}>
          <Field label="Camera name">
            <input
              style={styles.input}
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              placeholder="CAM 01"
            />
          </Field>

          <Field label="Location label">
            <input
              style={styles.input}
              value={form.location}
              onChange={(event) => setField('location', event.target.value)}
              placeholder="Entrance"
            />
          </Field>

          <Field label="Source type">
            <select
              style={styles.select}
              value={form.sourceType}
              onChange={(event) => {
                const nextSourceType = event.target.value
                setForm((current) => ({
                  ...current,
                  sourceType: nextSourceType,
                  sourceUrl: '',
                  targetModel: current.targetModel || getDefaultTargetModel(),
                }))
                setTestState('idle')
                setTestMessage('')
              }}
            >
              {SOURCE_TYPES.map((sourceType) => (
                <option key={sourceType.value} value={sourceType.value}>
                  {sourceType.label} - {sourceType.description}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Detection model">
            <select
              style={styles.select}
              value={form.targetModel || getDefaultTargetModel()}
              onChange={(event) => setField('targetModel', event.target.value)}
            >
              <option value="person">Person Detection</option>
              <option value="both">Person & Phone Detection</option>
              <option value="phone">Phone Detection</option>
            </select>
          </Field>

          <Field label={form.sourceType === 'device' ? 'Device ID (optional)' : 'Stream URL / video path'}>
            <input
              style={styles.input}
              value={form.sourceUrl}
              onChange={(event) => setField('sourceUrl', event.target.value)}
              placeholder={URL_PLACEHOLDERS[form.sourceType]}
              spellCheck={false}
            />
            <span style={styles.hint}>{URL_HINTS[form.sourceType]}</span>
          </Field>
        </div>

        <div style={styles.footer}>
          <div style={styles.footerStatus}>
            {testState === 'ok' ? (
              <span style={styles.statusSuccess}><Wifi size={12} color="#38b45a" /> Connected</span>
            ) : testState === 'fail' ? (
              <span style={styles.statusFail}><WifiOff size={12} color="#d52521" /> Failed</span>
            ) : testState === 'testing' ? (
              <span style={styles.statusNeutral}>Testing source...</span>
            ) : (
              <span style={styles.statusNeutral}>Run a live connection test before saving.</span>
            )}
            {testMessage && <span style={styles.footerHint}>{testMessage}</span>}
          </div>

          <div style={styles.footerActions}>
            <Button variant="secondary" size="sm" onClick={handleTest} disabled={testState === 'testing' || isSaving}>
              Test Connection
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!form.name.trim() || isSaving}>
              {isSaving ? 'Processing...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }) {
  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  )
}

function buildCameraId(name) {
  const slug = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10) || 'CAM'
  return `CAM_${slug}_${Math.floor(Math.random() * 1000)}`
}

async function testDeviceSource(deviceId) {
  const constraints = {
    video: deviceId ? { deviceId: { exact: deviceId } } : true,
    audio: false,
  }

  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  stream.getTracks().forEach((track) => track.stop())
}

async function testBackendSource({ sourceType, sourceUrl, targetModel }) {
  const testId = `TEST_${Date.now()}`

  try {
    const response = await fetch(`${DETECTION_SERVER}/cameras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testId,
        source: sourceType === 'device' ? 'push' : sourceUrl,
        model: targetModel,
      }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(payload?.error || 'The backend rejected this source.')
    }

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await sleep(600)
      const debugResponse = await fetch(`${DETECTION_SERVER}/debug/${testId}`)
      if (!debugResponse.ok) continue
      const debugPayload = await debugResponse.json()
      if (debugPayload?.current_stats?.has_frame) {
        return true
      }
      if (debugPayload?.detector_running === false) {
        return false
      }
    }

    return false
  } finally {
    await fetch(`${DETECTION_SERVER}/cameras/${testId}`, { method: 'DELETE' }).catch(() => {})
  }
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 100,
  },
  modal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '520px',
    maxHeight: '90vh',
    backgroundColor: '#151515',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    zIndex: 101,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '18px 20px 14px',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#c0c0be',
    letterSpacing: '0.01em',
  },
  subtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  subtitleText: {
    fontSize: '11px',
    color: '#4a4a4a',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    border: 'none',
    flexShrink: 0,
  },
  divider: {
    height: '1px',
    backgroundColor: '#252525',
    flexShrink: 0,
  },
  body: {
    padding: '16px 20px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#4a4a4a',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#101011',
    border: '1px solid #2a2a2a',
    borderRadius: '5px',
    padding: '10px 12px',
    fontSize: '12px',
    color: '#9fa09e',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    width: '100%',
  },
  select: {
    width: '100%',
    backgroundColor: '#101011',
    border: '1px solid #2a2a2a',
    borderRadius: '5px',
    padding: '10px 12px',
    fontSize: '12px',
    color: '#9fa09e',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'auto',
  },
  hint: {
    fontSize: '10px',
    color: '#535553',
    lineHeight: 1.5,
  },
  footer: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '12px 20px',
    borderTop: '1px solid #252525',
    flexShrink: 0,
  },
  footerStatus: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    minWidth: 0,
    flex: 1,
  },
  footerHint: {
    fontSize: '10px',
    color: '#737573',
    lineHeight: 1.5,
  },
  statusSuccess: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#59c878',
    fontWeight: 700,
  },
  statusFail: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#df5f58',
    fontWeight: 700,
  },
  statusNeutral: {
    fontSize: '11px',
    color: '#8a8c8a',
    fontWeight: 700,
  },
  footerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
}
