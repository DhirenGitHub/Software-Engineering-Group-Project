/**
 * StatusDot — animated pulsing dot for ONLINE/OFFLINE status
 */
export default function StatusDot({ online = true, size = 8 }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: online ? '#d52521' : '#4a4a4a',
        boxShadow: online ? '0 0 6px rgba(213,37,33,0.6)' : 'none',
        flexShrink: 0,
      }}
    />
  )
}
