/**
 * Badge — small status/count pill, e.g. "3 CRITICAL"
 * variant: 'critical' | 'neutral'
 */
export default function Badge({ children, variant = 'neutral' }) {
  const styles = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.04em',
    backgroundColor: variant === 'critical' ? 'rgba(213,37,33,0.15)' : '#161717',
    color: variant === 'critical' ? '#d52521' : '#7b7c7b',
    border: `1px solid ${variant === 'critical' ? 'rgba(213,37,33,0.3)' : '#1b1b1b'}`,
  }

  return <span style={styles}>{children}</span>
}
