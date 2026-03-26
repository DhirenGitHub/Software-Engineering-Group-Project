import Tag from '../ui/Tag'
import Button from '../ui/Button'
import { Camera, Trash2 } from 'lucide-react'

/**
 * CameraConfigRow — one camera entry in the Camera Feed Configuration list.
 * Shows: thumbnail placeholder, name, RTSP URL, location tag, feature tags, Configure + Remove buttons.
 */
export default function CameraConfigRow({ camera, onConfigure, onRemove }) {
  const { label, name, location, sourceUrl, rtsp, features = [], active } = camera
  const displayUrl = sourceUrl || rtsp || ''

  return (
    <div style={styles.row}>
      {/* Camera thumbnail */}
      <div style={styles.thumb}>
        <Camera size={16} color="#2a2a2a" strokeWidth={1} />
      </div>

      {/* Name + URL */}
      <div style={styles.info}>
        <div style={styles.nameRow}>
          <span style={styles.camName}>{label || name}</span>
          <div style={styles.statusBadge}>
            <span style={styles.statusDot} />
            <span style={styles.statusText}>ACTIVE</span>
          </div>
        </div>
        <span style={styles.rtsp}>{displayUrl}</span>
      </div>

      {/* Location + feature tags */}
      <div style={styles.tags}>
        {location && (
          <span style={styles.locationTag}>{location}</span>
        )}
        {features.map((f) => (
          <Tag key={f}>{f}</Tag>
        ))}
      </div>

      {/* Configure + Remove buttons */}
      <div style={styles.actions}>
        <Button variant="secondary" size="sm" onClick={onConfigure}>Configure</Button>
        <button onClick={onRemove} style={styles.removeBtn} title="Remove camera">
          <Trash2 size={13} color="#4a4a4a" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    height: '72px',
    padding: '0 16px',
    backgroundColor: '#090909',
    border: '1px solid #141414',
    borderRadius: '4px',
    marginBottom: '4px',
  },
  thumb: {
    width: '40px',
    height: '40px',
    borderRadius: '4px',
    backgroundColor: '#0f0f0f',
    border: '1px solid #1a1a1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    minWidth: '140px',
    flexShrink: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  camName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#a4a3a3',
    letterSpacing: '0.02em',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  statusDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#d52521',
    boxShadow: '0 0 4px rgba(213,37,33,0.5)',
  },
  statusText: {
    fontSize: '9px',
    color: '#616362',
    letterSpacing: '0.04em',
  },
  rtsp: {
    fontSize: '10px',
    color: '#3f3f3e',
    fontFamily: 'monospace',
    letterSpacing: '0.01em',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px',
    flex: 1,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  removeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    border: '1px solid #1a1a1a',
    cursor: 'pointer',
  },
  locationTag: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 7px',
    borderRadius: '3px',
    fontSize: '9px',
    backgroundColor: '#262525',
    color: '#5e5f5e',
    border: '1px solid #141414',
    letterSpacing: '0.04em',
    fontWeight: 400,
    whiteSpace: 'nowrap',
  },
}
