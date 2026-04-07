import CameraFeed from './CameraFeed'
import { Video } from 'lucide-react'

/**
 * CameraGrid — dynamic grid that adjusts columns based on camera count.
 * 0 cams → empty state
 * 1      → 1×1
 * 2      → 2×1
 * 3–4    → 2×2
 * 5–6    → 3×2
 * 7+     → 3×3
 */
function gridCols(count) {
  if (count <= 1) return 1
  if (count <= 4) return 2
  return 3
}

export default function CameraGrid({ cameras, onAddCamera, detectionOn = true }) {
  if (cameras.length === 0) {
    return (
      <div style={styles.empty}>
        <Video size={36} color="#1e1e1e" strokeWidth={1} />
        <span style={styles.emptyTitle}>NO CAMERAS CONFIGURED</span>
        <span style={styles.emptyHint}>Go to Settings → Camera Feeds to add a camera</span>
        <button style={styles.addBtn} onClick={onAddCamera}>
          + Add Camera
        </button>
      </div>
    )
  }

  const cols = gridCols(cameras.length)

  return (
    <div
      style={{
        ...styles.grid,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
      }}
    >
      {cameras.map((cam) => (
        <CameraFeed key={cam.id} camera={cam} detectionOn={detectionOn} />
      ))}
    </div>
  )
}

const styles = {
  grid: {
    display: 'grid',
    width: '100%',
    height: '100%',
    gap: '2px',
    backgroundColor: '#060606',
    gridAutoRows: '1fr',
  },
  empty: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    backgroundColor: '#080808',
  },
  emptyTitle: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#2a2a2a',
    letterSpacing: '0.08em',
  },
  emptyHint: {
    fontSize: '10px',
    color: '#1e1e1e',
  },
  addBtn: {
    marginTop: '8px',
    fontSize: '10px',
    fontWeight: 700,
    color: '#5c5f60',
    backgroundColor: '#0f0f0f',
    border: '1px solid #2a2a2a',
    borderRadius: '5px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    letterSpacing: '0.04em',
    transition: 'border-color 0.15s',
  },
}
