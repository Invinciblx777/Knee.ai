import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../lib/LanguageContext'
import { Card, ErrorNote } from '../components/ui'
import Icon from '../components/Icon'

/**
 * Shown between password sign-in and the app when the account has a
 * verified TOTP factor and the current session hasn't stepped up to aal2 yet.
 * App.jsx decides when to render this — it owns the session/AAL state — this
 * component only runs the challenge and hands back control on success.
 */
export default function MfaChallenge({ onVerified }) {
  const { t } = useLanguage()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const verify = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors()
      if (listErr) throw listErr
      const factor = factors.totp.find((f) => f.status === 'verified')
      if (!factor) throw new Error('No verified authenticator found on this account.')

      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: code.trim(),
      })
      if (verifyErr) throw verifyErr

      onVerified()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const useDifferentAccount = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page p-6 animate-fade-up">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-[32px] font-serif font-bold text-navy tracking-tight">Knee<span className="text-accent">.AI</span></h1>
        </div>

        <Card title={t('mfaChallengeTitle')} icon="shield">
          <p className="mt-1 text-[13px] text-muted font-display leading-relaxed">{t('mfaChallengeSubtitle')}</p>

          <form onSubmit={verify} className="mt-4 space-y-4">
            {error && <ErrorNote>{error}</ErrorNote>}

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="input h-12 text-[22px] text-center tracking-[0.4em] font-display font-bold"
              placeholder="000000"
              autoFocus
            />

            <button
              type="submit"
              disabled={loading || code.trim().length !== 6}
              className="btn-primary w-full h-10 flex justify-center"
            >
              {loading ? t('mfaVerifying') : (
                <>
                  <Icon name="shield" size={15} />
                  {t('mfaVerifyButton')}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-ink-100 pt-4">
            <button
              onClick={useDifferentAccount}
              className="text-[12px] font-display font-semibold text-accent hover:text-navy transition-colors duration-200"
            >
              {t('mfaUseDifferentAccount')}
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
