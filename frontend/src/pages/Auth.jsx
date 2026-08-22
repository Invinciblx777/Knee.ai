import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../lib/LanguageContext'
import { Card, ErrorNote } from '../components/ui'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const { t } = useLanguage()

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const authCall = mode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password, options: { data: { role: 'patient' } } })

    const { error: err } = await authCall

    if (err) {
      setError(err.message)
    } else if (mode === 'signup') {
      // Supabase auto-logins on signup unless confirm is enabled.
      // If it doesn't, we can just show a message or switch to login.
      alert(t('signupSuccess'))
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page p-6 animate-fade-up">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-[32px] font-serif font-bold text-navy tracking-tight">Knee<span className="text-accent">.AI</span></h1>
          <p className="text-muted text-[13px] font-display mt-1">{t('authTagline')}</p>
        </div>

        <Card title={mode === 'login' ? t('signIn') : t('createAccount')} icon="user">
          <form onSubmit={handleAuth} className="mt-4 space-y-4">
            {error && <ErrorNote>{error}</ErrorNote>}

            <div>
              <label className="block text-[11px] font-display font-semibold text-muted uppercase tracking-wider mb-1.5">
                {t('emailAddress')}
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
                {t('password')}
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

            <button type="submit" disabled={loading} className="btn-primary w-full h-10 mt-4 flex justify-center">
              {loading ? t('pleaseWait') : (mode === 'login' ? t('signIn') : t('createAccount'))}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-ink-100 pt-4">
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
              className="text-[12px] font-display font-semibold text-accent hover:text-navy transition-colors duration-200"
            >
              {mode === 'login' ? t('noAccount') : t('haveAccount')}
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
