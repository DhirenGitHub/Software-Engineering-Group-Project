export const DETECTION_SERVER = (() => {
  if (typeof window === 'undefined') return 'http://localhost:5000'
  const { hostname } = window.location
  return `http://${hostname || 'localhost'}:5000`
})()
