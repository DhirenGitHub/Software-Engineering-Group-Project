import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashboardPage  from './pages/DashboardPage'
import AnalyticsPage  from './pages/AnalyticsPage'
import SettingsPage   from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<DashboardPage />}  />
        <Route path="/analytics"  element={<AnalyticsPage />}  />
        <Route path="/settings"   element={<SettingsPage />}   />
        {/* Catch-all → dashboard */}
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
