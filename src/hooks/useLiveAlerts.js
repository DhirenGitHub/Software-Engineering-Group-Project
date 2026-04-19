import { useEffect, useState } from 'react'

const DETECTION_SERVER = 'http://localhost:5000'
const POLL_MS = 2000

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

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const response = await fetch(`${DETECTION_SERVER}/alerts`)
        if (!response.ok) throw new Error('alerts unavailable')
        const data = await response.json()
        if (cancelled) return
        setAlerts(Array.isArray(data) ? data.map(normalizeAlert) : [])
        setStatus('live')
      } catch {
        if (cancelled) return
        setAlerts([])
        setStatus('offline')
      }
    }

    poll()
    const timer = window.setInterval(poll, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return { alerts, status }
}
