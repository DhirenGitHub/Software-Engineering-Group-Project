import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { CameraProvider } from './context/CameraContext'

function Loading() {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh', 
      backgroundColor: '#080808',
      color: '#626261',
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      letterSpacing: '0.1em',
    }}>
      INITIALIZING...
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CameraProvider>
      <Suspense fallback={<Loading />}>
        <App />
      </Suspense>
    </CameraProvider>
  </StrictMode>
)
