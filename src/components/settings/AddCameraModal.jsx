import { useState, useEffect, useRef } from 'react'
import { X, Wifi, WifiOff } from 'lucide-react'
import Button from '../ui/Button'
import StatusDot from '../ui/StatusDot'


const SOURCE_TYPES = [
  { value: 'rtsp',       label: 'RTSP',        description: 'Real IP camera stream' },
  { value: 'mjpeg_http', label: 'MJPEG HTTP',  description: 'MJPEG over HTTP — direct stream URL' },
  { value: 'hls',        label: 'HLS',          description: 'HLS .m3u8 adaptive stream' },
  { value: 'webrtc',     label: 'WebRTC',       description: 'Ultra low-latency WebRTC feed' },
  { value: 'file',       label: 'Video File',   description: 'Local video file (loops — good for testing)' },
  { value: 'device',     label: 'Webcam',       description: 'Browser webcam via MediaDevices API' },
]

const URL_PLACEHOLDERS = {
  rtsp:       'rtsp://192.168.1.101/stream1',
  mjpeg_http: 'http://192.168.1.101/mjpeg',
  hls:        'http://192.168.1.101/stream/index.m3u8',
  webrtc:     'wss://your-signaling-server/room/cam01',
  file:       'http://localhost:5173/sample.mp4',
  device:     '',
}

const URL_HINTS = {
  rtsp:       'RTSP streams require a server-side proxy — the browser cannot connect directly.',
  mjpeg_http: 'MJPEG streams load as a plain <img> tag — no extra processing needed.',
  hls:        'HLS streams are played via hls.js. Ensure CORS headers are set on the server.',
  webrtc:     'Provide the WebRTC signaling server URL.',
  file:       'Serve the file from a local HTTP server or use a public URL. The video will loop.',
  device:     'The browser will prompt for camera permission. Leave URL blank to use the default webcam, or enter a deviceId.',
}

const EMPTY_FORM = {
  name: '',
  location: '',
  sourceType: 'mjpeg_http',
  sourceUrl: '',
  features: [],   // populated later from the monitoring view
}

/**
 * AddCameraModal — slide-in right panel / centered modal for adding or editing a camera.
 * Props:
 *   open       — boolean
 *   onClose    — () => void
 *   onSave     — (CameraConfig) => void
 *   initial    — CameraConfig | null  (populate for edit mode)
 */
export default function AddCameraModal({ open, onClose, onSave, initial = null }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [testState, setTestState] = useState('idle') // 'idle' | 'testing' | 'ok' | 'fail'
  const overlayRef = useRef(null)

  // Reset / populate form when modal opens
  useEffect(() => {
    if (open) {
      setForm(initial ?? EMPTY_FORM)
      setTestState('idle')
    }
  }, [open, initial])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = () => {
    if (!form.name.trim()) return
    onSave({ ...form, name: form.name.trim(), location: form.location.trim() })
    onClose()
  }

  const handleTest = async () => {
    setTestState('testing')
    // Simulate a connection test (real integration would ping the URL)
    await new Promise((r) => setTimeout(r, 1200))
    setTestState(form.sourceUrl ? 'ok' : 'fail')
  }

  const isEdit = !!initial

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
        style={styles.backdrop}
      />

      {/* Modal panel */}
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.title}>
              {isEdit ? `Configure ${initial.name}` : 'Add Camera'}
            </span>
            {isEdit && (
              <div style={styles.subtitle}>
                <span style={styles.subtitleText}>{initial.location} · </span>
                <StatusDot online={initial.active} size={7} />
                <span style={styles.subtitleText}> ACTIVE</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={16} color="#636463" strokeWidth={1.5} />
          </button>
        </div>

        <div style={styles.divider} />

        {/* Form body */}
        <div style={styles.body}>
          <Field label="Camera name">
            <input
              style={styles.input}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="CAM 01"
            />
          </Field>

          <Field label="Location label">
            <input
              style={styles.input}
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Entrance"
            />
          </Field>

          <Field label="Source type">
            <div style={styles.selectWrapper}>
              <select
                style={styles.select}
                value={form.sourceType}
                onChange={(e) => { set('sourceType', e.target.value); set('sourceUrl', '') }}
              >
                {SOURCE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.description}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          {form.sourceType !== 'device' && (
            <Field label="Stream URL">
              <input
                style={styles.input}
                value={form.sourceUrl}
                onChange={(e) => set('sourceUrl', e.target.value)}
                placeholder={URL_PLACEHOLDERS[form.sourceType]}
                spellCheck={false}
              />
              <span style={styles.hint}>{URL_HINTS[form.sourceType]}</span>
            </Field>
          )}

          {form.sourceType === 'device' && (
            <Field label="Device ID (optional)">
              <input
                style={styles.input}
                value={form.sourceUrl}
                onChange={(e) => set('sourceUrl', e.target.value)}
                placeholder="Leave blank for default webcam"
              />
              <span style={styles.hint}>{URL_HINTS.device}</span>
            </Field>
          )}

        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <Button variant="secondary" size="sm" onClick={handleTest} style={{ gap: '6px' }}>
            {testState === 'testing' ? (
              <span style={{ fontSize: '10px' }}>Testing…</span>
            ) : testState === 'ok' ? (
              <><Wifi size={12} color="#38b45a" /><span>Connected</span></>
            ) : testState === 'fail' ? (
              <><WifiOff size={12} color="#d52521" /><span>Failed</span></>
            ) : (
              'Test connection'
            )}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            style={{ opacity: form.name.trim() ? 1 : 0.4 }}
          >
            Save
          </Button>
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
    width: '500px',
    maxHeight: '90vh',
    backgroundColor: '#1c1c1c',
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
    backgroundColor: '#131314',
    border: '1px solid #2a2a2a',
    borderRadius: '5px',
    padding: '9px 12px',
    fontSize: '12px',
    color: '#9fa09e',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.15s',
  },
  selectWrapper: {
    position: 'relative',
  },
  select: {
    width: '100%',
    backgroundColor: '#131314',
    border: '1px solid #2a2a2a',
    borderRadius: '5px',
    padding: '9px 12px',
    fontSize: '12px',
    color: '#9fa09e',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'auto',
  },
  hint: {
    fontSize: '9px',
    color: '#3c3d3c',
    lineHeight: 1.5,
    marginTop: '2px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '12px 20px',
    borderTop: '1px solid #252525',
    flexShrink: 0,
  },
}
