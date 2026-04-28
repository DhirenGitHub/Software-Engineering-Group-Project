import { useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { DETECTION_SERVER } from '../../lib/detectionServer'
import useSearchStatus from '../../hooks/useSearchStatus'

export default function SearchPanel({ variant = 'sidebar' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const { data: searchData, status: searchStatus } = useSearchStatus()
  const hasIndexError = Boolean(searchData?.error)

  const handleSearch = async () => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return

    setStatus('loading')
    setResults([])
    setErrorMessage('')

    try {
      const response = await fetch(`${DETECTION_SERVER}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmedQuery }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || 'Smart search failed')
      }

      setResults(Array.isArray(payload) ? payload : [])
      setStatus('done')
    } catch (error) {
      setStatus('error')
      setErrorMessage(error.message || 'Smart search is unavailable right now.')
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSearch()
    }
  }

  if (variant === 'tile') {
    return (
      <div style={tile.panel}>
        <div style={tile.inputRow}>
          <Search size={17} color="#b8b8b8" strokeWidth={1.8} />
          <input
            style={tile.input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find people, phones, or scenes in indexed footage..."
          />
          <button onClick={handleSearch} style={tile.actionButton} type="button" disabled={status === 'loading'}>
            {status === 'loading' ? <Loader2 size={16} color="#d5d5d5" strokeWidth={1.8} /> : <Search size={16} color="#d5d5d5" strokeWidth={1.8} />}
          </button>
        </div>

        <div style={tile.hero}>
          <div style={tile.heroCircle}>
            <Search size={24} color="#d0d0d0" strokeWidth={1.7} />
          </div>
          <span style={tile.heroTitle}>CHROMADB SMART SEARCH</span>
          <span style={tile.heroText}>
            Query indexed detections with natural language and jump back into the right moment faster.
          </span>
          <div style={tile.heroMeta}>
            <span
              style={
                hasIndexError
                  ? tile.metaChipError
                  : searchStatus === 'live' && searchData?.ready
                    ? tile.metaChipReady
                    : tile.metaChipStandby
              }
            >
              {hasIndexError ? 'INDEX ERROR' : searchStatus === 'live' && searchData?.ready ? 'INDEX READY' : 'INDEX STANDBY'}
            </span>
            <span style={tile.metaChipNeutral}>
              {searchStatus === 'live' ? `${searchData?.indexed_items || 0} indexed items` : 'Backend offline'}
            </span>
          </div>
        </div>

        {hasIndexError && (
          <div style={tile.inlineMessageError}>{searchData.error}</div>
        )}

        {status === 'error' && (
          <div style={tile.inlineMessageError}>{errorMessage}</div>
        )}
        {status === 'done' && results.length === 0 && (
          <div style={tile.inlineMessage}>No matches found for that query yet.</div>
        )}
        {results.length > 0 && (
          <div style={tile.results}>
            {results.slice(0, 4).map((result, index) => (
              <ResultCard key={`${result.image_file || 'match'}-${index}`} result={result} rank={index + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={sidebar.panel}>
      <div style={sidebar.header}>
        <Search size={12} color="#626261" strokeWidth={1.5} />
        <span style={sidebar.headerTitle}>SMART SEARCH</span>
      </div>

      <div style={sidebar.inputRow}>
        <input
          style={sidebar.input}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. person in blue shirt"
        />
        <button
          onClick={handleSearch}
          disabled={status === 'loading'}
          style={status === 'loading'
            ? { ...sidebar.searchBtn, ...sidebar.searchBtnDisabled }
            : sidebar.searchBtn}
          type="button"
        >
          {status === 'loading' ? '...' : 'GO'}
        </button>
      </div>

      {status === 'error' && (
        <span style={sidebar.errorText}>{errorMessage}</span>
      )}
      {status === 'done' && results.length === 0 && (
        <span style={sidebar.emptyText}>No matches found yet.</span>
      )}
      {results.length > 0 && (
        <div style={sidebar.results}>
          {results.map((result, index) => (
            <ResultRow key={`${result.image_file || 'match'}-${index}`} result={result} rank={index + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function FadeImage({ src, alt, style, onErrorStyle = 'hidden' }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <img
      src={src}
      alt={alt}
      style={{
        ...style,
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.25s ease-in',
      }}
      onLoad={() => setLoaded(true)}
      onError={(event) => {
        if (onErrorStyle === 'hidden') {
          event.currentTarget.style.visibility = 'hidden'
        } else {
          event.currentTarget.style.display = 'none'
        }
      }}
    />
  )
}

function ResultCard({ result, rank }) {
  return (
    <div style={tile.resultCard}>
      <FadeImage
        src={result.image_url}
        alt={`Match ${rank}`}
        style={tile.resultThumb}
        onErrorStyle="hidden"
      />
      <div style={tile.resultMeta}>
        <span style={tile.resultRank}>#{rank}</span>
        <span style={tile.resultCam}>{formatCameraLabel(result.cam_id)}</span>
        <span style={tile.resultTime}>{formatUnixTime(result.timestamp)}</span>
      </div>
    </div>
  )
}

function ResultRow({ result, rank }) {
  return (
    <div style={sidebar.resultRow}>
      <FadeImage
        src={result.image_url}
        alt={`Match ${rank}`}
        style={sidebar.thumb}
        onErrorStyle="none"
      />
      <div style={sidebar.resultMeta}>
        <span style={sidebar.rankText}>#{rank} MATCH</span>
        <span style={sidebar.metaText} title={result.cam_id}>
          {formatCameraLabel(result.cam_id)}
        </span>
        <div style={sidebar.badgeContainer}>
          <span style={sidebar.timeBadge}>{formatUnixTime(result.timestamp)}</span>
          <span style={sidebar.scoreBadge}>Score: {formatScore(result.score)}</span>
        </div>
      </div>
    </div>
  )
}

function formatUnixTime(unixSeconds) {
  if (!unixSeconds) return '--:--:--'

  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatCameraLabel(camId) {
  let cleanCamId = camId ? camId.split(/[/\\]/).pop() : 'LIVE FEED'
  if (cleanCamId.length > 22) {
    cleanCamId = `${cleanCamId.slice(0, 19)}...`
  }
  return cleanCamId
}

function formatScore(score) {
  return typeof score === 'number' ? score.toFixed(1) : 'N/A'
}

const sidebar = {
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
    color: '#9d4c4c',
    letterSpacing: '0.02em',
    lineHeight: 1.5,
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
    color: '#38b45a',
    letterSpacing: '0.02em',
  },
}

const tile = {
  panel: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid #1c1c1c',
    background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08), rgba(9,9,9,0.94) 52%), linear-gradient(180deg, rgba(24,24,24,0.96), rgba(8,8,8,0.98))',
    overflow: 'hidden',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '46px',
    padding: '0 12px',
    borderRadius: '10px',
    backgroundColor: 'rgba(36,36,36,0.94)',
    border: '1px solid #2d2d2d',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#d0d0d0',
    fontSize: '13px',
    fontFamily: 'Inter, sans-serif',
  },
  actionButton: {
    display: 'grid',
    placeItems: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '999px',
    border: '1px solid #383838',
    backgroundColor: '#181818',
    cursor: 'pointer',
    flexShrink: 0,
  },
  hero: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    textAlign: 'center',
    padding: '10px 16px 6px',
  },
  heroCircle: {
    display: 'grid',
    placeItems: 'center',
    width: '54px',
    height: '54px',
    borderRadius: '999px',
    backgroundColor: 'rgba(18,18,18,0.9)',
    border: '1px solid #2b2b2b',
    boxShadow: '0 12px 24px rgba(0,0,0,0.25)',
  },
  heroTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#d0d0ce',
    letterSpacing: '0.02em',
  },
  heroText: {
    maxWidth: '360px',
    fontSize: '12px',
    lineHeight: 1.7,
    color: '#7a7b79',
  },
  heroMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  metaChipReady: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 9px',
    borderRadius: '999px',
    backgroundColor: '#102214',
    border: '1px solid #21482c',
    color: '#77d08d',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.06em',
  },
  metaChipStandby: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 9px',
    borderRadius: '999px',
    backgroundColor: '#1d1a12',
    border: '1px solid #3f3520',
    color: '#d2b06b',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.06em',
  },
  metaChipError: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 9px',
    borderRadius: '999px',
    backgroundColor: '#241010',
    border: '1px solid #5c2020',
    color: '#ef9088',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.06em',
  },
  metaChipNeutral: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 9px',
    borderRadius: '999px',
    backgroundColor: '#161616',
    border: '1px solid #292929',
    color: '#9a9b99',
    fontSize: '10px',
    fontWeight: 700,
  },
  inlineMessage: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #1d1d1d',
    backgroundColor: 'rgba(12,12,12,0.9)',
    color: '#8a8b89',
    fontSize: '11px',
  },
  inlineMessageError: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #4f2020',
    backgroundColor: 'rgba(26,10,10,0.94)',
    color: '#f18c85',
    fontSize: '11px',
  },
  results: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    marginTop: 'auto',
  },
  resultCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
    padding: '10px',
    borderRadius: '10px',
    backgroundColor: 'rgba(10,10,10,0.9)',
    border: '1px solid #1d1d1d',
  },
  resultThumb: {
    width: '56px',
    height: '72px',
    borderRadius: '6px',
    objectFit: 'cover',
    backgroundColor: '#050505',
    border: '1px solid #202020',
    flexShrink: 0,
  },
  resultMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    minWidth: 0,
  },
  resultRank: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#d14539',
    letterSpacing: '0.06em',
  },
  resultCam: {
    fontSize: '11px',
    color: '#b3b3b1',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  resultTime: {
    fontSize: '10px',
    color: '#6f706e',
    fontVariantNumeric: 'tabular-nums',
  },
}
