// ─── Live Clock ─────────────────────────────────────────────────────────────
export const systemStatus = {
  fps: 28,
  online: true,
}

// ─── Cameras ─────────────────────────────────────────────────────────────────
export const cameras = [
  {
    id: 'CAM01',
    label: 'CAM 01',
    location: 'ENTRANCE',
    rtsp: 'rtsp://192.168.1.101/stream1',
    active: true,
    features: ['PHONE DETECTION', 'TRIPWIRE'],
    overlays: {
      queueZone: { label: 'QUEUE ZONE', queueLength: 7, avgDwell: '4:15' },
      tripwire: { name: 'TRIPWIRE A', inCount: 145, outCount: 132 },
      personIds: ['1D128', '151'],
    },
  },
  {
    id: 'CAM02',
    label: 'CAM 02',
    location: 'FOOD COURT',
    rtsp: 'rtsp://192.168.1.102/stream1',
    active: true,
    features: ['CROWD COUNT', 'HEATMAP'],
    overlays: {
      heatmap: 'HEATMAP: VISITOR',
    },
  },
  {
    id: 'CAM03',
    label: 'CAM 03',
    location: 'CORRIDOR',
    rtsp: 'rtsp://192.168.1.103/stream1',
    active: true,
    features: ['TRAJECTORY', 'TRIPWIRE'],
    overlays: {
      tripwire: { name: 'TRIPWIRE B', inCount: 89, outCount: 76 },
      personIds: ['ID318', 'ID305'],
      faceRecognition: 'MALAA',
    },
  },
  {
    id: 'CAM04',
    label: 'CAM 04',
    location: 'LOBBY',
    rtsp: 'rtsp://192.168.1.104/stream2',
    active: true,
    features: ['FACE RECOGNITION'],
    overlays: {},
    isSearch: true,
  },
]

// ─── Alerts ──────────────────────────────────────────────────────────────────
export const alerts = [
  { id: 1, type: 'Phone Detection',        timestamp: '14:32:08', target: 'ID135',  severity: 'critical' },
  { id: 2, type: 'Loitering Alert',        timestamp: '14:30:45', target: 'ID128',  severity: 'warning'  },
  { id: 3, type: 'Zone Capacity Warning',  timestamp: '14:28:12', target: 'Zone A', severity: 'warning'  },
  { id: 4, type: 'Tripwire Crossed',       timestamp: '14:25:33', target: 'ID097',  severity: 'critical' },
  { id: 5, type: 'Phone Detection',        timestamp: '14:22:19', target: 'ID112',  severity: 'critical' },
]

// ─── Zone Analytics ───────────────────────────────────────────────────────────
export const zoneAnalytics = {
  queue:  12,
  dwell:  '3.4m',
  loiter: 1,
}

// ─── Footfall Trends ─────────────────────────────────────────────────────────
export const footfallData = [
  { day: 'Mon', count: 420 },
  { day: 'Tue', count: 380 },
  { day: 'Wed', count: 510 },
  { day: 'Thu', count: 600 },
  { day: 'Fri', count: 475 },
  { day: 'Sat', count: 290 },
  { day: 'Sun', count: 220 },
]

// ─── Analytics / Crowd Count ─────────────────────────────────────────────────
export const crowdCountData = {
  oneDay: Array.from({ length: 24 }, (_, i) => ({
    time: `${String(i).padStart(2, '0')}:00`,
    count: Math.floor(Math.random() * 400 + 50),
  })),
  oneWeek: Array.from({ length: 7 }, (_, i) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return { time: days[i], count: Math.floor(Math.random() * 600 + 100) }
  }),
  oneMonth: Array.from({ length: 30 }, (_, i) => ({
    time: `${i + 1}`,
    count: Math.floor(Math.random() * 700 + 80),
  })),
}

export const analyticsMetrics = {
  avgCrowd: 'A130',
  peakDwell: '14.2m',
  incidents: '33',
  camera: 'NTC',
}

// ─── Settings Nav ─────────────────────────────────────────────────────────────
export const settingsNavItems = [
  { id: 'camera-feeds',       label: 'Camera Feeds'      },
  { id: 'analytics-engine',   label: 'Analytics Engine'  },
  { id: 'nanodb-config',      label: 'NanoDB Config'     },
  { id: 'security-access',    label: 'Security & Access' },
  { id: 'alert-rules',        label: 'Alert Rules'       },
  { id: 'storage-management', label: 'Storage Management'},
  { id: 'user-management',    label: 'User Management'   },
]
