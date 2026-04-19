import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const CameraContext = createContext(null)

const STORAGE_KEY = 'segp_cameras'
const DETECTION_SERVER = 'http://localhost:5000'
const DEFAULT_BACKEND_MODEL = 'person'
const BACKEND_REHYDRATE_SOURCE_TYPES = new Set(['device', 'file'])

function normalizeCamera(camera) {
  if (!camera || typeof camera !== 'object') return null

  return {
    ...camera,
    targetModel: camera.targetModel || DEFAULT_BACKEND_MODEL,
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(normalizeCamera).filter(Boolean) : []
  } catch {
    return []
  }
}

function saveToStorage(cameras) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cameras))
}

function getBackendSource(camera) {
  const sourceType = camera.rawSourceType || camera.sourceType
  const rawSource = camera.rawUrl !== undefined ? camera.rawUrl : camera.sourceUrl

  if (sourceType === 'device') {
    return 'push'
  }

  return rawSource
}

function shouldRehydrateBackend(camera) {
  const sourceType = camera.rawSourceType || camera.sourceType
  return Boolean(
    camera.backendId &&
    sourceType &&
    BACKEND_REHYDRATE_SOURCE_TYPES.has(sourceType) &&
    getBackendSource(camera)
  )
}

export function CameraProvider({ children }) {
  const [cameras, setCameras] = useState(loadFromStorage)

  const addCamera = useCallback((config) => {
    setCameras((prev) => {
      const id = config.id || `CAM${String(prev.length + 1).padStart(2, '0')}`
      const next = [...prev, normalizeCamera({ ...config, id, active: true })]
      saveToStorage(next)
      return next
    })
  }, [])

  const updateCamera = useCallback((id, updates) => {
    setCameras((prev) => {
      const next = prev.map((camera) => (
        camera.id === id ? normalizeCamera({ ...camera, ...updates }) : camera
      ))
      saveToStorage(next)
      return next
    })
  }, [])

  const removeCamera = useCallback((id) => {
    setCameras((prev) => {
      const next = prev.filter((camera) => camera.id !== id)
      saveToStorage(next)
      return next
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const syncPersistedCameras = async () => {
      const persistedBackendCameras = cameras.filter(shouldRehydrateBackend)
      if (persistedBackendCameras.length === 0) return

      let registeredCameraIds = new Set()
      try {
        const response = await fetch(`${DETECTION_SERVER}/cameras`)
        if (!response.ok) return
        const backendCameras = await response.json()
        registeredCameraIds = new Set(
          (Array.isArray(backendCameras) ? backendCameras : []).map((camera) => camera.id)
        )
      } catch {
        return
      }

      for (const camera of persistedBackendCameras) {
        const backendId = camera.backendId || camera.id
        if (registeredCameraIds.has(backendId)) continue

        const sourceType = camera.rawSourceType || camera.sourceType
        const source = getBackendSource(camera)
        const targetModel = camera.targetModel || DEFAULT_BACKEND_MODEL

        try {
          const response = await fetch(`${DETECTION_SERVER}/cameras`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: backendId, source, model: targetModel }),
          })
          if (!response.ok) continue

          const data = await response.json()
          registeredCameraIds.add(backendId)
          if (cancelled) return

          setCameras((prev) => {
            let changed = false
            const next = prev.map((existing) => (
              existing.id === camera.id
                ? (() => {
                    const updated = {
                      ...existing,
                      sourceType: 'mjpeg_http',
                      sourceUrl: data.stream,
                      rawSourceType: sourceType,
                      rawUrl: camera.rawUrl !== undefined ? camera.rawUrl : camera.sourceUrl,
                      backendId,
                      targetModel,
                    }
                    if (
                      existing.sourceType === updated.sourceType &&
                      existing.sourceUrl === updated.sourceUrl &&
                      existing.rawSourceType === updated.rawSourceType &&
                      existing.rawUrl === updated.rawUrl &&
                      existing.backendId === updated.backendId &&
                      existing.targetModel === updated.targetModel
                    ) {
                      return existing
                    }
                    changed = true
                    return updated
                  })()
                : existing
            ))
            if (!changed) return prev
            saveToStorage(next)
            return next
          })
        } catch {
          // Keep the saved camera config intact if the backend is offline.
        }
      }
    }

    syncPersistedCameras()
    const timer = window.setInterval(syncPersistedCameras, 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [cameras])

  return (
    <CameraContext.Provider value={{ cameras, addCamera, updateCamera, removeCamera }}>
      {children}
    </CameraContext.Provider>
  )
}

export function useCameras() {
  const ctx = useContext(CameraContext)
  if (!ctx) throw new Error('useCameras must be used inside CameraProvider')
  return ctx
}
