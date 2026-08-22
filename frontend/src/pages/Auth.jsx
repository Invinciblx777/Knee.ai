import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card, ErrorNote } from '../components/ui'
import Icon from '../components/Icon'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('patient')
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup'

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const authCall = mode === 'login' 
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password, options: { data: { role } } })

    const { error: err } = await authCall
    
    if (err) {
      setError(err.message)
    } else if (mode === 'signup') {
      // Supabase auto-logins on signup unless confirm is enabled.
      // If it doesn't, we can just show a message or switch to login.
      alert('Signup successful! Check your email if confirmation is required.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page p-6 animate-fade-up">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-[32px] font-serif font-bold text-navy tracking-tight">Knee<span className="text-accent">.AI</span></h1>
          <p className="text-muted text-[13px] font-display mt-1">Clinical decision support platform</p>
        </div>

        <Card title={mode === 'login' ? 'Sign In' : 'Create Account'} icon="user">
          <form onSubmit={handleAuth} className="mt-4 space-y-4">
            {error && <ErrorNote>{error}</ErrorNote>}
            
            <div>
              <label className="block text-[11px] font-display font-semibold text-muted uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input h-10 text-[14px]"
                placeholder="doctor@clinic.com"
              />
            </div>
            
            <div>
              <label className="block text-[11px] font-display font-semibold text-muted uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input h-10 text-[14px]"
                placeholder="••••••••"
              />
            </div>

            {mode === 'signup' && (
              <div className="pt-2">
                <label className="block text-[11px] font-display font-semibold text-muted uppercase tracking-wider mb-2">
                  I am a:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('patient')}
                    className={`h-10 rounded-[8px] text-[13px] font-display font-semibold transition-all duration-150 ${
                      role === 'patient' 
                        ? 'bg-accent-light text-accent border-2 border-navy' 
                        : 'bg-page text-muted border-2 border-transparent hover:bg-ink-50'
                    }`}
                  >
                    Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('doctor')}
                    className={`h-10 rounded-[8px] text-[13px] font-display font-semibold transition-all duration-150 ${
                      role === 'doctor' 
                        ? 'bg-accent-light text-accent border-2 border-navy' 
                        : 'bg-page text-muted border-2 border-transparent hover:bg-ink-50'
                    }`}
                  >
                    Doctor
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full h-10 mt-4 flex justify-center">
              {loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-ink-100 pt-4">
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
              className="text-[12px] font-display font-semibold text-accent hover:text-navy transition-colors duration-200"
            >
              {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
