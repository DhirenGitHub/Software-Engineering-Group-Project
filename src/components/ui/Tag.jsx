/**
 * Tag ??compact chip used for camera labels and mode tags.
 */
export default function Tag({ children }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: '3px',
        fontSize: '9px',
        fontWeight: 400,
        letterSpacing: '0.03em',
        backgroundColor: '#121113',
        color: '#6e706e',
        border: '1px solid #404143',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
