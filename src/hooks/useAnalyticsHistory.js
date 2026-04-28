import { useEffect, useState, useRef } from 'react'
import { DETECTION_SERVER } from '../lib/detectionServer'

const POLL_MS = 5000
const FETCH_TIMEOUT_MS = 5000
const MAX_SAMPLES = 2160
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const STORAGE_KEY = 'segp_analytics_history'

function normalizeDebugSample(payload) {
  const stats = payload?.current_stats || {}

  return {
    cameraId: payload?.cam_id || 'UNKNOWN',
    personCount: Number(stats.person_count || 0),
    phoneCount: Number(stats.phone_count || 0),
    totalCount: Number(stats.total_count || 0),
    updatedAt: Number(stats.updated_at || 0),
    hasFrame: Boolean(stats.has_frame),
  }
}

function loadStoredHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []

    if (!Array.isArray(parsed)) return []

    const cutoff = Date.now() - MAX_AGE_MS

    return parsed
      .filter((sample) => (
        sample &&
        Number.isFinite(sample.timestamp) &&
        sample.timestamp >= cutoff &&
        Array.isArray(sample.cameras)
      ))
      .slice(-MAX_SAMPLES)
  } catch {
    return []
  }
}

function saveStoredHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_SAMPLES)))
  } catch {
  }
}

export default function useAnalyticsHistory() {
  const [history, setHistory] = useState(loadStoredHistory)
  const [status, setStatus] = useState('idle')
  const abortRef = useRef(false)

  useEffect(() => {
    abortRef.current = false

    const poll = async () => {
      if (abortRef.current) return

      try {
        const camerasResponse = await fetch(`${DETECTION_SERVER}/cameras`, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
        if (!camerasResponse.ok) throw new Error('cameras unavailable')
        const cameras = await camerasResponse.json()

        const debugPayloads = await Promise.all(
          (Array.isArray(cameras) ? cameras : []).map(async (camera) => {
            try {
              const response = await fetch(`${DETECTION_SERVER}/debug/${camera.id}`, {
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
              })
              if (!response.ok) return null
              return await response.json()
            } catch {
              return null
            }
          }),
        )

        const debugSamples = debugPayloads
          .filter(Boolean)
          .map(normalizeDebugSample)

        const nextSample = {
          timestamp: Date.now(),
          totalPeople: debugSamples.reduce((sum, sample) => sum + sample.personCount, 0),
          totalPhones: debugSamples.reduce((sum, sample) => sum + sample.phoneCount, 0),
          totalDetections: debugSamples.reduce((sum, sample) => sum + sample.totalCount, 0),
          cameras: debugSamples,
        }

        if (abortRef.current) return

        setHistory((current) => {
          const nextHistory = [...current, nextSample]
            .filter((sample) => nextSample.timestamp - sample.timestamp <= MAX_AGE_MS)
            .slice(-MAX_SAMPLES)

          saveStoredHistory(nextHistory)
          return nextHistory
        })
        setStatus('live')
      } catch {
        if (abortRef.current) return
        setStatus('offline')
      }
    }

    poll()
    const timer = window.setInterval(poll, POLL_MS)

    return () => {
      abortRef.current = true
      window.clearInterval(timer)
    }
  }, [])

  return { history, status }
}
