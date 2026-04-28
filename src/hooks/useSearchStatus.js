import { useEffect, useState, useRef } from 'react'
import { DETECTION_SERVER } from '../lib/detectionServer'

const POLL_MS = 4000
const FETCH_TIMEOUT_MS = 5000

export default function useSearchStatus() {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('idle')
  const abortRef = useRef(false)

  useEffect(() => {
    abortRef.current = false

    const poll = async () => {
      if (abortRef.current) return

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

        const response = await fetch(`${DETECTION_SERVER}/search/status`, {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!response.ok) throw new Error('search status unavailable')
        const payload = await response.json()
        if (abortRef.current) return
        setData(payload)
        setStatus('live')
      } catch {
        if (abortRef.current) return
        setData(null)
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

  return { data, status }
}
