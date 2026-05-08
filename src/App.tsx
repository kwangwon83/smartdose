import { Routes, Route } from 'react-router'
import { AppProvider } from '@/contexts/AppContext'
import { ToastProvider } from '@/components/Toast'
import Home from './pages/Home'
import DosageAction from './pages/DosageAction'
import History from './pages/History'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Settings from './pages/Settings'

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dosage" element={<DosageAction />} />
          <Route path="/history" element={<History />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback/:provider" element={<AuthCallback />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </ToastProvider>
    </AppProvider>
  )
}
