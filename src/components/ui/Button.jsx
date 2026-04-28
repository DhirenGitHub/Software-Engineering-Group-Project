/**
 * Button — reusable button component
 * variant: 'primary' | 'secondary' | 'ghost'
 * size: 'sm' | 'md'
 */
export default function Button({ children, variant = 'secondary', size = 'md', onClick, style = {}, disabled = false, type = 'button' }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 700,
    letterSpacing: '0.02em',
    borderRadius: '5.5px',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  }

  const variants = {
    primary: {
      backgroundColor: '#d52521',
      border: '1px solid #cf221e',
      color: '#e2e7e9',
    },
    secondary: {
      backgroundColor: '#000001',
      border: '1px solid #484548',
      color: '#5c5f60',
    },
    ghost: {
      backgroundColor: 'transparent',
      border: '1px solid #1b1b1b',
      color: '#626261',
    },
  }

  const sizes = {
    sm: { fontSize: '10px', padding: '4px 10px', height: '28px' },
    md: { fontSize: '11px', padding: '6px 14px', height: '33px' },
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...base,
        ...variants[variant],
        ...sizes[size],
        ...(disabled ? { opacity: 0.45, cursor: 'default' } : null),
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.opacity = '0.8'
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.opacity = '1'
      }}
    >
      {children}
    </button>
  )
}
