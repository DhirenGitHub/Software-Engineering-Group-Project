import { useEffect, useRef, useState } from 'react'
import { Video, WifiOff, Loader } from 'lucide-react'
import Hls from 'hls.js'

/**
 * CameraFeed — renders the correct video element for each sourceType,
 * with detection overlays on top.
 */
export default function CameraFeed({ camera, detectionOn = true }) {
  const { label, location, overlays = {}, sourceType, sourceUrl, rawUrl, rawSourceType } = camera

  const [heatmapOn, setHeatmapOn] = useState(false)

  // 1. Create Heatmap URL safely (Swaps "video" or "video_feed" to "heatmap")
  const heatmapUrl = sourceUrl ? sourceUrl.replace(/video[^/]*\//, 'heatmap/') : null

  // 2. Determine what to display based on the toggles
  let activeType = sourceType
  let activeUrl = sourceUrl

  if (!detectionOn) {
    // AI is OFF -> try to use raw source
    activeType = rawSourceType || sourceType
    activeUrl = rawUrl || sourceUrl
  } else if (heatmapOn && heatmapUrl) {
    // AI is ON and Heatmap is ON -> use Heatmap stream
    activeType = sourceType
    activeUrl = heatmapUrl
  }

  // 3. Security Guardrail: Prevent local C:/ drives from crashing the browser
  const isLocalFile = activeType === 'file' && activeUrl && !activeUrl.startsWith('http') && !activeUrl.startsWith('blob:')
  if (isLocalFile) {
    activeType = 'blocked_local'
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.feedBg}>

        {/* ── Video layer ── */}
        <FeedVideo sourceType={activeType} sourceUrl={activeUrl} />

        {/* ── Overlays ── */}
        <div style={styles.camLabel}>
          <Video size={10} color="#a4a3a3" strokeWidth={2} />
          <span style={styles.camLabelText}>{label || camera.name}</span>
          {location && <span style={styles.locationText}>{location}</span>}
        </div>

        <div style={styles.recPill}>
          <span style={styles.recDot} />
          <span style={styles.recText}>REC</span>
        </div>

        {overlays.queueZone && (
          <div style={styles.queueZone}>
            <div style={styles.queueZoneInner}>
              <span style={styles.overlayLabel}>QUEUE ZONE</span>
              <span style={styles.overlayValue}>QUEUE LENGTH: {overlays.queueZone.queueLength}</span>
              <span style={styles.overlayValue}>AVG. DWELL: {overlays.queueZone.avgDwell}</span>
            </div>
          </div>
        )}

        {overlays.tripwire && (
          <div style={styles.tripwireOverlay}>
            <span style={styles.tripwireName}>{overlays.tripwire.name}</span>
            <span style={styles.tripwireCount}>
              IN:{overlays.tripwire.inCount} | OUT:{overlays.tripwire.outCount}
            </span>
          </div>
        )}

        {overlays.heatmap && (
          <div style={styles.heatmapBadge}>
            <span style={styles.overlayLabel}>{overlays.heatmap}</span>
          </div>
        )}

        {/* HEAT Button: Only shows if AI detection is ON and a heatmap URL exists */}
        {heatmapUrl && detectionOn && (
          <button
            onClick={() => setHeatmapOn(v => !v)}
            style={heatmapOn ? styles.heatmapToggleActive : styles.heatmapToggle}
          >
            HEAT
          </button>
        )}

        {overlays.faceRecognition && (
          <div style={styles.faceBadge}>
            <span style={styles.faceText}>{overlays.faceRecognition}</span>
          </div>
        )}

        {overlays.personIds?.map((id) => (
          <div key={id} style={styles.personId}>
            <span style={styles.personIdText}>{id}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Source-type renderers ──────────────────────────────────────────────────

function FeedVideo({ sourceType, sourceUrl }) {
  switch (sourceType) {
    case 'mjpeg_http':    return <MjpegFeed   url={sourceUrl} />
    case 'file':          return <VideoFileFeed url={sourceUrl} />
    case 'blocked_local': return <ErrorState label="Raw local files blocked by browser. Turn AI Detection back on." />
    case 'device':        return <DeviceFeed   deviceId={sourceUrl} />
    case 'hls':           return <HlsFeed      url={sourceUrl} />
    case 'rtsp':          return <RtspPlaceholder />
    case 'webrtc':        return <WebRtcPlaceholder />
    default:              return <DarkPlaceholder />
  }
}

/** MJPEG HTTP — rendered as a plain <img> which streams MJPEG natively */
function MjpegFeed({ url }) {
  const [error, setError] = useState(false)
  if (!url) return <DarkPlaceholder />
  if (error) return <ErrorState label="MJPEG unreachable" />
  return (
    <img
      src={url}
      alt=""
      style={styles.feedMedia}
      onError={() => setError(true)}
    />
  )
}

/** Local video file — loops silently */
function VideoFileFeed({ url }) {
  if (!url) return <DarkPlaceholder />
  return (
    <video
      src={url}
      style={styles.feedMedia}
      autoPlay
      loop
      muted
      playsInline
    />
  )
}

/** Browser webcam via getUserMedia */
function DeviceFeed({ deviceId }) {
  const videoRef = useRef(null)
  const [state, setState] = useState('idle') // idle | loading | active | denied

  useEffect(() => {
    let stream = null
    setState('loading')
    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false,
    }
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((s) => {
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
        setState('active')
      })
      .catch(() => setState('denied'))

    return () => {
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [deviceId])

  if (state === 'denied')  return <ErrorState label="Camera access denied" />
  if (state === 'loading') return <LoadingState label="Requesting camera…" />

  return (
    <video
      ref={videoRef}
      style={styles.feedMedia}
      autoPlay
      muted
      playsInline
    />
  )
}

/** HLS stream via hls.js */
function HlsFeed({ url }) {
  const videoRef = useRef(null)
  const hlsRef   = useRef(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!url || !videoRef.current) return
    setError(false)

    if (Hls.isSupported()) {
      const hls = new Hls()
      hlsRef.current = hls
      hls.loadSource(url)
      hls.attachMedia(videoRef.current)
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setError(true)
      })
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      videoRef.current.src = url
    } else {
      setError(true)
    }

    return () => { hlsRef.current?.destroy() }
  }, [url])

  if (!url)   return <DarkPlaceholder />
  if (error)  return <ErrorState label="HLS stream failed" />

  return (
    <video
      ref={videoRef}
      style={styles.feedMedia}
      autoPlay
      muted
      playsInline
    />
  )
}

/** RTSP — cannot play directly in browser; show info panel */
function RtspPlaceholder() {
  return (
    <div style={styles.placeholder}>
      <WifiOff size={26} color="#2a2a2a" strokeWidth={1} />
      <span style={styles.placeholderTitle}>RTSP</span>
      <span style={styles.placeholderHint}>
        Requires a server-side proxy (e.g. ffmpeg → MJPEG/HLS)
      </span>
    </div>
  )
}

/** WebRTC placeholder */
function WebRtcPlaceholder() {
  return (
    <div style={styles.placeholder}>
      <Video size={26} color="#2a2a2a" strokeWidth={1} />
      <span style={styles.placeholderTitle}>WEBRTC</span>
      <span style={styles.placeholderHint}>Awaiting signaling connection</span>
    </div>
  )
}

/** Generic dark placeholder (no source configured) */
function DarkPlaceholder() {
  return (
    <div style={styles.placeholder}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${15 + i * 14}%`, height: '1px', backgroundColor: 'rgba(255,255,255,0.02)' }} />
      ))}
      <Video size={32} color="#1e1e1e" strokeWidth={1} style={{ position: 'relative', zIndex: 1 }} />
      <span style={{ ...styles.placeholderHint, position: 'relative', zIndex: 1 }}>No source configured</span>
    </div>
  )
}

function LoadingState({ label }) {
  return (
    <div style={styles.placeholder}>
      <Loader size={22} color="#3a3a3a" strokeWidth={1} />
      <span style={styles.placeholderHint}>{label}</span>
    </div>
  )
}

function ErrorState({ label }) {
  return (
    <div style={styles.placeholder}>
      <WifiOff size={22} color="#6a2020" strokeWidth={1} />
      <span style={{ ...styles.placeholderHint, color: '#5a2020' }}>{label}</span>
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = {
  wrapper: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    border: '1px solid #141414',
    backgroundColor: '#050505',
    position: 'relative',
  },
  feedBg: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  feedMedia: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    backgroundColor: '#0b0b0c',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0b0b0c',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    position: 'relative',
    overflow: 'hidden',
  },
  placeholderTitle: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#2a2a2a',
    letterSpacing: '0.1em',
  },
  placeholderHint: {
    fontSize: '8px',
    color: '#232323',
    textAlign: 'center',
    maxWidth: '160px',
    lineHeight: 1.5,
  },
  camLabel: {
    position: 'absolute', top: 12, left: 12,
    display: 'flex', alignItems: 'center', gap: '5px',
    backgroundColor: 'rgba(0,0,0,0.75)',
    border: '1px solid #1e1e1e', borderRadius: '3px',
    padding: '4px 8px', zIndex: 10,
  },
  camLabelText: { fontSize: '10px', fontWeight: 700, color: '#a4a3a3', letterSpacing: '0.06em' },
  locationText: { fontSize: '9px', color: '#636463', letterSpacing: '0.05em', marginLeft: '4px' },
  recPill: {
    position: 'absolute', top: 12, right: 12,
    display: 'flex', alignItems: 'center', gap: '5px',
    backgroundColor: 'rgba(0,0,0,0.75)',
    border: '1px solid #1e1e1e', borderRadius: '3px',
    padding: '4px 8px', zIndex: 10,
  },
  recDot: {
    display: 'inline-block', width: '7px', height: '7px',
    borderRadius: '50%', backgroundColor: '#d52521',
    boxShadow: '0 0 5px rgba(213,37,33,0.7)',
  },
  recText: { fontSize: '9px', fontWeight: 700, color: '#d52521', letterSpacing: '0.08em' },
  queueZone: { position: 'absolute', bottom: '28%', left: '5%', zIndex: 10 },
  queueZoneInner: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    border: '1px solid rgba(213,37,33,0.4)', borderRadius: '3px', padding: '5px 8px',
  },
  overlayLabel: { fontSize: '8px', fontWeight: 700, color: '#d52521', letterSpacing: '0.06em' },
  overlayValue: { fontSize: '8px', color: '#8a8a8a', letterSpacing: '0.03em' },
  tripwireOverlay: { position: 'absolute', bottom: '18%', left: '5%', display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 10 },
  tripwireName: { fontSize: '8px', fontWeight: 700, color: '#e8c44a', letterSpacing: '0.06em', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 5px', borderRadius: '2px', border: '1px solid rgba(232,196,74,0.3)' },
  tripwireCount: { fontSize: '8px', color: '#8a8a8a', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 5px', borderRadius: '2px', border: '1px solid #1e1e1e', letterSpacing: '0.02em' },
  heatmapBadge: { position: 'absolute', bottom: 10, left: 12, backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(213,37,33,0.3)', borderRadius: '3px', padding: '4px 8px', zIndex: 10 },
  faceBadge: { position: 'absolute', bottom: '12%', left: '10%', backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(56,180,90,0.4)', borderRadius: '3px', padding: '3px 7px', zIndex: 10 },
  faceText: { fontSize: '9px', fontWeight: 700, color: '#38b45a', letterSpacing: '0.06em' },
  personId: { position: 'absolute', top: '35%', right: '15%', backgroundColor: 'rgba(0,0,0,0.75)', border: '1px solid #2a2a2a', borderRadius: '2px', padding: '2px 5px', zIndex: 10 },
  personIdText: { fontSize: '8px', color: '#6e706e', letterSpacing: '0.04em' },
  heatmapToggle: {
    position: 'absolute', bottom: 10, right: 12, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.75)', border: '1px solid #2a2a2a',
    borderRadius: '3px', padding: '4px 8px', cursor: 'pointer',
    fontSize: '9px', fontWeight: 700, color: '#636463', letterSpacing: '0.08em',
  },
  heatmapToggleActive: {
    position: 'absolute', bottom: 10, right: 12, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.75)', border: '1px solid rgba(213,37,33,0.5)',
    borderRadius: '3px', padding: '4px 8px', cursor: 'pointer',
    fontSize: '9px', fontWeight: 700, color: '#d52521', letterSpacing: '0.08em',
  },
}