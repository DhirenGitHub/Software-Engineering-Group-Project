import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader, Video, WifiOff } from 'lucide-react'
import Hls from 'hls.js'
import { DETECTION_SERVER } from '../../lib/detectionServer'

export default function CameraFeed({ camera, detectionOn = true }) {
  const { label, location, sourceType, sourceUrl, rawUrl, rawSourceType, backendId } = camera

  // ── View mode: 'live' | 'heatmap'
  const [viewMode, setViewMode] = useState('live')

  // ── Feature toggles (synced with backend)
  const [anomalyOn, setAnomalyOn] = useState(false)

  // ── Anomaly state (polled from backend)
  const [anomalyActive, setAnomalyActive] = useState(false)
  const [anomalyDetail, setAnomalyDetail] = useState('')
  const [anomalyKind, setAnomalyKind] = useState(null)

  const hasBackend = Boolean(backendId)

  // ── Toggle a feature flag on the backend
  const toggleAnomaly = useCallback(async () => {
    if (!hasBackend) return
    const nextValue = !anomalyOn
    try {
      await fetch(`${DETECTION_SERVER}/cameras/${backendId}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomaly: nextValue }),
      })
      setAnomalyOn(nextValue)
    } catch {
      setAnomalyOn(nextValue)
    }
  }, [backendId, hasBackend, anomalyOn])

  // ── Poll features + anomaly state every 2 s when backend camera is active
  useEffect(() => {
    if (!hasBackend) return undefined

    const poll = async () => {
      try {
        const res = await fetch(`${DETECTION_SERVER}/cameras/${backendId}/features`)
        if (!res.ok) return
        const data = await res.json()
        setAnomalyOn(Boolean(data.anomaly))
        const state = data.anomalyState || {}
        setAnomalyActive(Boolean(state.active))
        setAnomalyDetail(state.detail || '')
        setAnomalyKind(state.kind || null)
      } catch { /* backend offline */ }
    }

    poll()
    const timer = window.setInterval(poll, 2000)
    return () => window.clearInterval(timer)
  }, [backendId, hasBackend])

  // ── Determine which URL to show
  let activeType = sourceType
  let activeUrl = sourceUrl

  if (!detectionOn) {
    activeType = rawSourceType || sourceType
    activeUrl = rawUrl || sourceUrl
  }

  // Heatmap override — only for backend-proxied cameras
  if (viewMode === 'heatmap' && hasBackend && detectionOn) {
    activeType = 'mjpeg_http'
    activeUrl = `${DETECTION_SERVER}/heatmap/${backendId}`
  }

  const isLocalFile = activeType === 'file' && activeUrl && !activeUrl.startsWith('http') && !activeUrl.startsWith('blob:')
  if (isLocalFile) activeType = 'blocked_local'

  return (
    <div style={{ ...styles.wrapper, ...(anomalyActive ? styles.wrapperAnomaly : {}) }}>
      <div style={styles.feedBg}>
        {rawSourceType === 'device' && backendId && detectionOn && (
          <DevicePushBridge backendId={backendId} deviceId={rawUrl} />
        )}

        <FeedVideo sourceType={activeType} sourceUrl={activeUrl} />

        {/* Camera label — top left */}
        <div style={styles.camLabel}>
          <Video size={10} color="#d1d1cf" strokeWidth={1.8} />
          <span style={styles.camLabelText}>{label || camera.name}</span>
          {location && <span style={styles.locationText}>{location}</span>}
        </div>

        {/* REC pill — top right */}
        <div style={styles.recPill}>
          <span style={styles.recDot} />
          <span style={styles.recText}>REC</span>
        </div>

        {/* Anomaly badge — shown when any anomaly is active */}
        {anomalyActive && (
          <div
            style={{
              ...styles.anomalyBadge,
              ...(anomalyKind === 'loitering' ? styles.anomalyBadgeLoitering : {}),
            }}
            title={anomalyDetail}
          >
            <span
              style={{
                ...styles.anomalyDot,
                ...(anomalyKind === 'loitering' ? styles.anomalyDotLoitering : {}),
              }}
            />
            <span style={styles.anomalyText}>
              {anomalyKind === 'panic' ? 'PANIC'
                : anomalyKind === 'loitering' ? 'LOITERING'
                : anomalyKind === 'surge' ? 'SURGE'
                : anomalyKind === 'dispersal' ? 'DISPERSAL'
                : 'ANOMALY'}
            </span>
          </div>
        )}

        {/* Feature button bar — bottom of tile, only for backend cameras */}
        {hasBackend && (
          <div style={styles.btnBar}>
            <FeatureBtn
              label="HEAT"
              active={viewMode === 'heatmap'}
              onClick={() => setViewMode((m) => (m === 'heatmap' ? 'live' : 'heatmap'))}
              title="Toggle heatmap overlay"
            />
            <FeatureBtn
              label="ANOMALY"
              active={anomalyOn}
              alert={anomalyActive}
              onClick={toggleAnomaly}
              title="Toggle crowd anomaly detection"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function FeatureBtn({ label, active, alert: isAlert, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        ...btnStyles.btn,
        ...(active ? btnStyles.btnActive : {}),
        ...(isAlert ? btnStyles.btnAlert : {}),
      }}
    >
      {isAlert && <span style={btnStyles.alertDot} />}
      {label}
    </button>
  )
}

function FeedVideo({ sourceType, sourceUrl }) {
  switch (sourceType) {
    case 'mjpeg_http':
      return <MjpegFeed url={sourceUrl} />
    case 'file':
      return <VideoFileFeed url={sourceUrl} />
    case 'blocked_local':
      return <ErrorState label="Raw local files are hidden while AI is off." />
    case 'device':
      return <DeviceFeed deviceId={sourceUrl} />
    case 'hls':
      return <HlsFeed url={sourceUrl} />
    case 'rtsp':
      return <RtspPlaceholder />
    default:
      return <DarkPlaceholder />
  }
}

function MjpegFeed({ url }) {
  const [error, setError] = useState(false)
  if (!url) return <DarkPlaceholder />
  if (error) return <ErrorState label="MJPEG stream unavailable" />
  return (
    <img
      src={url}
      alt=""
      style={styles.feedMedia}
      onError={() => setError(true)}
    />
  )
}

function VideoFileFeed({ url }) {
  if (!url) return <DarkPlaceholder />
  return (
    <video src={url} style={styles.feedMedia} autoPlay loop muted playsInline />
  )
}

function DeviceFeed({ deviceId }) {
  const videoRef = useRef(null)
  const [state, setState] = useState('idle')

  useEffect(() => {
    let stream = null
    setState('loading')
    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false,
    }
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((nextStream) => {
        stream = nextStream
        if (videoRef.current) videoRef.current.srcObject = nextStream
        setState('active')
      })
      .catch(() => setState('denied'))
    return () => { stream?.getTracks().forEach((t) => t.stop()) }
  }, [deviceId])

  if (state === 'denied') return <ErrorState label="Camera access denied" />
  if (state === 'loading') return <LoadingState label="Requesting camera..." />
  return <video ref={videoRef} style={styles.feedMedia} autoPlay muted playsInline />
}

function DevicePushBridge({ backendId, deviceId }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    let stream = null
    let timer = null
    let cancelled = false
    let sending = false

    const start = async () => {
      try {
        const constraints = {
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
          audio: false,
        }
        stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled || !videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})

        timer = window.setInterval(async () => {
          if (cancelled || sending || !videoRef.current || !canvasRef.current) return
          if (videoRef.current.readyState < 2) return
          const canvas = canvasRef.current
          const video = videoRef.current
          canvas.width = video.videoWidth || 640
          canvas.height = video.videoHeight || 480
          const context = canvas.getContext('2d')
          if (!context) return
          sending = true
          try {
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7))
            if (!blob) return
            await fetch(`${DETECTION_SERVER}/frame/${backendId}`, { method: 'POST', body: blob })
          } catch { /* keep retrying */ } finally { sending = false }
        }, 180)
      } catch { /* permission failed */ }
    }

    start()
    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [backendId, deviceId])

  return (
    <>
      <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  )
}

function HlsFeed({ url }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!url || !videoRef.current) return undefined
    setError(false)
    if (Hls.isSupported()) {
      const hls = new Hls()
      hlsRef.current = hls
      hls.loadSource(url)
      hls.attachMedia(videoRef.current)
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) setError(true) })
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = url
    } else {
      setError(true)
    }
    return () => { hlsRef.current?.destroy() }
  }, [url])

  if (!url) return <DarkPlaceholder />
  if (error) return <ErrorState label="HLS stream failed" />
  return <video ref={videoRef} style={styles.feedMedia} autoPlay muted playsInline />
}

function RtspPlaceholder() {
  return (
    <div style={styles.placeholder}>
      <WifiOff size={26} color="#2a2a2a" strokeWidth={1} />
      <span style={styles.placeholderTitle}>RTSP SOURCE</span>
      <span style={styles.placeholderHint}>Waiting for the backend proxy to expose the feed.</span>
    </div>
  )
}

function DarkPlaceholder() {
  return (
    <div style={styles.placeholder}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, right: 0,
          top: `${15 + i * 14}%`, height: '1px',
          backgroundColor: 'rgba(255,255,255,0.02)',
        }} />
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
      <span style={{ ...styles.placeholderHint, color: '#7a2f2f' }}>{label}</span>
    </div>
  )
}

const styles = {
  wrapper: {
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    border: '1px solid #141414',
    backgroundColor: '#050505',
    position: 'relative',
    borderRadius: '12px',
    transition: 'border-color 0.3s',
  },
  wrapperAnomaly: {
    border: '1px solid rgba(213, 37, 33, 0.6)',
    boxShadow: '0 0 12px rgba(213, 37, 33, 0.25)',
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
    color: '#2e2e2e',
    textAlign: 'center',
    maxWidth: '180px',
    lineHeight: 1.5,
  },
  camLabel: {
    position: 'absolute',
    top: 12,
    left: 12,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'rgba(0,0,0,0.78)',
    border: '1px solid #1e1e1e',
    borderRadius: '4px',
    padding: '5px 9px',
    zIndex: 10,
  },
  camLabelText: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#d1d1cf',
    letterSpacing: '0.06em',
  },
  locationText: {
    fontSize: '9px',
    color: '#8d8e8c',
    letterSpacing: '0.05em',
    marginLeft: '4px',
  },
  recPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: 'rgba(0,0,0,0.78)',
    border: '1px solid #1e1e1e',
    borderRadius: '4px',
    padding: '5px 9px',
    zIndex: 10,
  },
  recDot: {
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: '#d52521',
    boxShadow: '0 0 5px rgba(213,37,33,0.7)',
  },
  recText: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#d52521',
    letterSpacing: '0.08em',
  },
  anomalyBadge: {
    position: 'absolute',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: 'rgba(180, 20, 20, 0.85)',
    border: '1px solid rgba(213, 37, 33, 0.6)',
    borderRadius: '4px',
    padding: '4px 10px',
    zIndex: 10,
  },
  anomalyDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#ff6b6b',
    boxShadow: '0 0 6px rgba(255, 107, 107, 0.9)',
  },
  anomalyBadgeLoitering: {
    backgroundColor: 'rgba(120, 100, 0, 0.85)',
    border: '1px solid rgba(220, 180, 0, 0.6)',
  },
  anomalyDotLoitering: {
    backgroundColor: '#ffe066',
    boxShadow: '0 0 6px rgba(255, 224, 102, 0.9)',
  },
  anomalyText: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#ffcccc',
    letterSpacing: '0.1em',
  },
  btnBar: {
    position: 'absolute',
    bottom: 10,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '4px',
    zIndex: 10,
  },
}

const btnStyles = {
  btn: {
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '0.07em',
    color: '#8a8c8a',
    backgroundColor: 'rgba(0,0,0,0.72)',
    border: '1px solid #2a2a2a',
    borderRadius: '4px',
    padding: '4px 9px',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'border-color 0.15s, color 0.15s',
  },
  btnActive: {
    color: '#00e87a',
    borderColor: 'rgba(0, 232, 122, 0.45)',
    backgroundColor: 'rgba(0, 60, 30, 0.72)',
  },
  btnAlert: {
    color: '#ff6b6b',
    borderColor: 'rgba(213, 37, 33, 0.5)',
    backgroundColor: 'rgba(60, 10, 10, 0.72)',
  },
  alertDot: {
    display: 'inline-block',
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    backgroundColor: '#ff6b6b',
    boxShadow: '0 0 4px rgba(255,107,107,0.8)',
  },
}
