import { useState } from 'react'
import { Search } from 'lucide-react'

const DETECTION_SERVER = 'http://localhost:5000'

/**
 * SearchPanel — CLIP-powered natural language search over indexed person crops.
 * Sits in the right sidebar below ZoneAnalytics.
 */
export default function SearchPanel() {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus]   = useState('idle') // idle | loading | done | error

  const handleSearch = async () => {
    const q = query.trim()
    if (!q) return
    setStatus('loading')
    setResults([])
    try {
      const res  = await fetch(`${DETECTION_SERVER}/search`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: q }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'search failed')
      setResults(data)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSearch() }

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <Search size={12} color="#626261" strokeWidth={1.5} />
        <span style={styles.headerTitle}>SMART SEARCH</span>
      </div>

      {/* Input row */}
      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. person in blue shirt"
        />
        <button
          onClick={handleSearch}
          disabled={status === 'loading'}
          style={status === 'loading'
            ? { ...styles.searchBtn, ...styles.searchBtnDisabled }
            : styles.searchBtn}
        >
          {status === 'loading' ? '…' : 'GO'}
        </button>
      </div>

      {/* Status / results */}
      {status === 'error' && (
        <span style={styles.errorText}>Search unavailable — is CLIP loaded?</span>
      )}
      {status === 'done' && results.length === 0 && (
        <span style={styles.emptyText}>No matches found.</span>
      )}
      {results.length > 0 && (
        <div style={styles.results}>
          {results.map((r, i) => (
            <ResultRow key={i} result={r} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function ResultRow({ result, rank }) {

  const formatTime = (unixSeconds) => {
    if (!unixSeconds) return '--:--:--'


    const date = new Date(unixSeconds * 1000)


    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // 2. Clean up the long C:/ file path to just show the filename
  let cleanCamId = result.cam_id ? result.cam_id.split(/[/\\]/).pop() : 'LIVE FEED'
  // Truncate if it's still too long to fit nicely
  if (cleanCamId.length > 22) cleanCamId = cleanCamId.substring(0, 19) + '...'

  // 3. Clean up the score
  const cleanScore = result.score ? result.score.toFixed(1) : 'N/A'

  return (
    <div style={styles.resultRow}>
      <img
        src={result.image_url}
        alt={`Match ${rank}`}
        style={styles.thumb}
        onError={(e) => { e.target.style.display = 'none' }}
      />
      <div style={styles.resultMeta}>
        <span style={styles.rankText}>#{rank} MATCH</span>

        <span style={styles.metaText} title={result.cam_id}>
          {cleanCamId}
        </span>

        <div style={styles.badgeContainer}>
          <span style={styles.timeBadge}>⏱️ {formatTime(result.timestamp)}</span>
          <span style={styles.scoreBadge}>Score: {cleanScore}</span>
        </div>
      </div>
    </div>
  )
}

const styles = {
  panel: {
    borderTop: '1px solid #141414',
    padding: '10px 12px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
  },
  headerTitle: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#626261',
    letterSpacing: '0.06em',
  },
  inputRow: {
    display: 'flex',
    gap: '6px',
  },
  input: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '3px',
    padding: '6px 8px',
    fontSize: '10px',
    color: '#9fa09e',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
  },
  searchBtn: {
    backgroundColor: '#141414',
    border: '1px solid #2a2a2a',
    borderRadius: '3px',
    padding: '6px 10px',
    fontSize: '9px',
    fontWeight: 700,
    color: '#626261',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'Inter, sans-serif',
  },
  searchBtnDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
  errorText: {
    fontSize: '9px',
    color: '#6a2020',
    letterSpacing: '0.02em',
  },
  emptyText: {
    fontSize: '9px',
    color: '#3c3d3c',
    letterSpacing: '0.02em',
  },
  results: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  resultRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    border: '1px solid #141414',
    borderRadius: '4px',
    padding: '8px',
  },
  thumb: {
    width: '50px',
    height: '66px',
    objectFit: 'cover',
    borderRadius: '3px',
    flexShrink: 0,
    backgroundColor: '#050505',
    border: '1px solid #1a1a1a',
  },
  resultMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minWidth: 0,
  },
  rankText: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#8a8a8a',
    letterSpacing: '0.06em',
  },
  metaText: {
    fontSize: '9px',
    color: '#5c5d5c',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  badgeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '2px',
  },
  timeBadge: {
    fontSize: '9px',
    color: '#9fa09e',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    padding: '2px 5px',
    borderRadius: '3px',
    fontVariantNumeric: 'tabular-nums',
  },
  scoreBadge: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#38b45a', // Dhiren's green accent color
    letterSpacing: '0.02em',
  },
}