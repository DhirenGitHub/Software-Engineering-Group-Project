import { createContext, useContext, useState, useCallback } from 'react'

const CameraContext = createContext(null)

const STORAGE_KEY = 'segp_cameras'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(cameras) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cameras))
}

export function CameraProvider({ children }) {
  const [cameras, setCameras] = useState(loadFromStorage)

  const addCamera = useCallback((config) => {
    setCameras((prev) => {
      const id = config.id || `CAM${String(prev.length + 1).padStart(2, '0')}`
      const next = [...prev, { ...config, id, active: true }]
      saveToStorage(next)
      return next
    })
  }, [])

  const updateCamera = useCallback((id, updates) => {
    setCameras((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      saveToStorage(next)
      return next
    })
  }, [])

  const removeCamera = useCallback((id) => {
    setCameras((prev) => {
      const next = prev.filter((c) => c.id !== id)
      saveToStorage(next)
      return next
    })
  }, [])

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
