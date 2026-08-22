import { useState, useEffect, createContext } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { configError, supabase } from './lib/supabase'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Dashboard from './pages/Dashboard'
import NewAnalysis from './pages/NewAnalysis'
import History from './pages/History'
import Research from './pages/Research'
import Settings from './pages/Settings'
import Results from './pages/Results'
import Auth from './pages/Auth'

export const AuthContext = createContext(null)

export default function App() {
  const [navOpen, setNavOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (configError) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (configError) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-6">
        <div
          className="max-w-md rounded-[12px] bg-danger-light px-5 py-4"
          style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}
        >
          <p className="text-[14px] font-display font-bold text-navy">Configuration error</p>
          <p className="mt-2 text-[13px] text-navy font-display leading-relaxed">{configError}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-page flex items-center justify-center text-muted font-display text-sm">Loading...</div>
  }

  if (!session) {
    return <Auth />
  }

  return (
    <AuthContext.Provider value={{ session, userRole: session?.user?.user_metadata?.role || 'patient' }}>
      <div className="min-h-screen bg-page">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="lg:pl-[220px]">
          <Topbar onMenu={() => setNavOpen(true)} />
          <main className="px-5 py-8 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new" element={<NewAnalysis />} />
              <Route path="/results/:id" element={<Results />} />
              <Route path="/history" element={<History />} />
              <Route path="/research" element={<Research />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </AuthContext.Provider>
  )
}
