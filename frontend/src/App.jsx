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
import OaAnalysis from './pages/OaAnalysis'
import ImplantSizing from './pages/ImplantSizing'
import Auth from './pages/Auth'
import MfaChallenge from './pages/MfaChallenge'
import ChatWidget from './components/ChatWidget'

export const AuthContext = createContext(null)

export default function App() {
  const [navOpen, setNavOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // { currentLevel, nextLevel } from supabase.auth.mfa — null until fetched
  // for the current session. Kept separate from `session` because a fresh
  // password sign-in already carries a session (aal1) before the TOTP step,
  // and rendering the app on session-presence alone would skip that step.
  const [mfaLevel, setMfaLevel] = useState(null)

  const refreshAal = async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setMfaLevel(data)
  }

  useEffect(() => {
    if (configError) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) await refreshAal()
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) await refreshAal()
      else setMfaLevel(null)
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

  // Session exists but its AAL hasn't been checked yet — render nothing
  // rather than the app, so a 2FA-enabled account never shows even a flash
  // of authenticated content before the TOTP step is enforced.
  if (mfaLevel === null) {
    return <div className="min-h-screen bg-page flex items-center justify-center text-muted font-display text-sm">Loading...</div>
  }

  const needsMfa = mfaLevel.nextLevel === 'aal2' && mfaLevel.currentLevel !== mfaLevel.nextLevel
  if (needsMfa) {
    return <MfaChallenge onVerified={refreshAal} />
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
              <Route path="/oa" element={<OaAnalysis />} />
              <Route path="/oa/:id" element={<OaAnalysis />} />
              <Route path="/implant" element={<ImplantSizing />} />
              <Route path="/implant/:id" element={<ImplantSizing />} />
              <Route path="/history" element={<History />} />
              <Route path="/research" element={<Research />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
        <ChatWidget />
      </div>
    </AuthContext.Provider>
  )
}
