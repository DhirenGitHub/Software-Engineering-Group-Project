import { useEffect, useState, useRef } from 'react'
import { DETECTION_SERVER } from '../lib/detectionServer'

const POLL_MS = 2000
const FETCH_TIMEOUT_MS = 5000

function normalizeAlert(alert) {
  const severity = alert?.severity || 'warning'
  const priorityLabel = alert?.priorityLabel || (
    severity === 'critical' ? 'High' : severity === 'warning' ? 'Medium' : 'Low'
  )
  const category = alert?.category || (
    alert?.kind === 'phone' ? 'Device Misuse'
      : alert?.kind === 'crowd' ? 'Crowd Monitoring'
      : alert?.kind === 'offline' ? 'Feed Health'
      : 'General'
  )

  return {
    ...alert,
    severity,
    priorityLabel,
    category,
    status: alert?.status || 'open',
  }
}

export default function useLiveAlerts() {
  const [alerts, setAlerts] = useState([])
  const [status, setStatus] = useState('idle')
  const abortRef = useRef(false)

  useEffect(() => {
    abortRef.current = false

    const poll = async () => {
      if (abortRef.current) return

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

        const response = await fetch(`${DETECTION_SERVER}/alerts`, {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!response.ok) throw new Error('alerts unavailable')
        const data = await response.json()
        if (abortRef.current) return
        setAlerts(Array.isArray(data) ? data.map(normalizeAlert) : [])
        setStatus('live')
      } catch {
        if (abortRef.current) return
        setAlerts([])
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

  return { alerts, status }
}
