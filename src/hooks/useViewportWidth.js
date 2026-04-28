import { useEffect, useState } from 'react'

function getWidth() {
  if (typeof window === 'undefined') return 1440
  return window.innerWidth
}

export default function useViewportWidth() {
  const [width, setWidth] = useState(getWidth)

  useEffect(() => {
    const handleResize = () => setWidth(getWidth())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return width
}
