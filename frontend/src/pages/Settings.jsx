import { useContext, useEffect, useState } from 'react'
import { getImplants } from '../lib/api'
import { supabase } from '../lib/supabase'
import { AuthContext } from '../App'
import { useLanguage } from '../lib/LanguageContext'
import { Card, ErrorNote, Spinner } from '../components/ui'
import Icon from '../components/Icon'

const THRESHOLDS = [
  ['classSevere', '< 3.0 mm', 'bg-danger'],
  ['classModerate', '3.0 – 4.0 mm', 'bg-warn'],
  ['classMild', '4.0 – 5.0 mm', 'bg-accent'],
  ['classNormal', '> 5.0 mm', 'bg-ok'],
]

export default function Settings() {
  const { session } = useContext(AuthContext)
  const { t } = useLanguage()
  const [db, setDb] = useState(null)
  const [error, setError] = useState('')
  const [system, setSystem] = useState(null)
  const [loggingOut, setLoggingOut] = useState(false)

  const [factors, setFactors] = useState(null)
  const [enrolling, setEnrolling] = useState(null) // { id, qr, secret }
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [mfaError, setMfaError] = useState('')

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
  }

  const loadFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    setFactors(data?.totp || [])
  }

  useEffect(() => {
    getImplants()
      .then((d) => {
        setDb(d)
        setSystem(d.systems[0].id)
      })
      .catch((e) => setError(e.message))
    loadFactors()
  }, [])

  const startEnroll = async () => {
    setMfaError('')
    try {
      // An earlier abandoned attempt (closed tab, failed render, etc.) can
      // leave an unverified TOTP factor behind, and Supabase refuses to
      // enroll a new one while it's still pending — clear it first so
      // "Enable 2FA" can never get permanently stuck.
      const { data: existing } = await supabase.auth.mfa.listFactors()
      const stale = (existing?.all || []).filter(
        (f) => f.factor_type === 'totp' && f.status === 'unverified'
      )
      for (const f of stale) {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {})
      }

      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        // Unique per attempt so a retry never collides with itself either.
        friendlyName: `authenticator-${Date.now()}`,
      })
      if (enrollErr) throw enrollErr
      setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    } catch (err) {
      setMfaError(err.message)
    }
  }

  const confirmEnroll = async (e) => {
    e.preventDefault()
    setMfaBusy(true)
    setMfaError('')
    try {
      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrolling.id, code: mfaCode.trim(),
      })
      if (verifyErr) throw verifyErr
      setEnrolling(null)
      setMfaCode('')
      await loadFactors()
    } catch (err) {
      setMfaError(err.message)
    } finally {
      setMfaBusy(false)
    }
  }

  const cancelEnroll = async () => {
    // Drop the pending, unverified factor rather than leaving it orphaned —
    // an abandoned enrollment shouldn't linger on the account.
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.id }).catch(() => {})
    setEnrolling(null)
    setMfaCode('')
    setMfaError('')
  }

  const removeFactor = async (factorId) => {
    if (!window.confirm(t('mfaRemoveConfirm'))) return
    setMfaBusy(true)
    setMfaError('')
    try {
      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId })
      if (unenrollErr) throw unenrollErr
      await loadFactors()
    } catch (err) {
      setMfaError(err.message)
    } finally {
      setMfaBusy(false)
    }
  }

  const active = db && db.systems.find((s) => s.id === system)
  const verifiedFactor = factors?.find((f) => f.status === 'verified')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">{t('navSettings')}</h2>
        <p className="text-[13px] text-muted mt-1 font-display">{t('settingsSubtitle')}</p>
      </div>

      <Card eyebrow="Account" title={t('signedInAs')} icon="user" tone="navy">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[14px] font-display font-medium text-navy">{session?.user?.email}</div>
            <div className="text-[12px] text-muted font-display capitalize mt-0.5">
              {session?.user?.user_metadata?.role || 'patient'} {t('account')}
            </div>
          </div>
          <button onClick={handleLogout} disabled={loggingOut} className="btn-dark h-9 px-4 text-[13px]">
            <Icon name="logout" size={15} />
            {loggingOut ? t('signingOut') : t('signOut')}
          </button>
        </div>
      </Card>

      <Card eyebrow="Security" title={t('mfaTitle')} icon="shield" tone="green">
        <p className="text-[13px] text-muted font-display leading-relaxed">{t('mfaDescription')}</p>

        {mfaError && <div className="mt-3"><ErrorNote>{mfaError}</ErrorNote></div>}

        {!enrolling && (
          <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
            <span
              className={`inline-flex items-center gap-2 h-8 px-3 rounded-full text-[12px] font-display font-semibold ${
                verifiedFactor ? 'bg-ok-light text-ok' : 'bg-page text-muted'
              }`}
              style={{ border: '2px solid #2D2016' }}
            >
              <span className={`w-2 h-2 rounded-full ${verifiedFactor ? 'bg-ok' : 'bg-ink-400'}`} />
              {verifiedFactor ? t('mfaEnabledStatus') : t('mfaDisabledStatus')}
            </span>

            {verifiedFactor ? (
              <button
                onClick={() => removeFactor(verifiedFactor.id)}
                disabled={mfaBusy}
                className="btn-ghost h-9 px-4 text-[13px]"
              >
                {t('mfaRemoveButton')}
              </button>
            ) : (
              <button onClick={startEnroll} className="btn-primary h-9 px-4 text-[13px]">
                <Icon name="shield" size={15} />
                {t('mfaEnableButton')}
              </button>
            )}
          </div>
        )}

        {enrolling && (
          <div className="mt-5 rounded-[12px] bg-page p-4" style={{ border: '2px solid #2D2016' }}>
            <p className="text-[12px] text-muted font-display leading-relaxed mb-3">{t('mfaScanQr')}</p>
            <div className="flex justify-center">
              <div
                className="w-[172px] h-[172px] bg-white rounded-[8px] p-2 flex items-center justify-center"
                style={{ border: '2px solid #2D2016' }}
              >
                {/* Supabase returns the QR as an SVG document (XML declaration and
                    all), not an HTML fragment — injecting it via innerHTML is what
                    produced a blank box. Its own docs point at this: wrap it as a
                    data: URI and let the browser's image decoder parse it as SVG,
                    same as any other image source. */}
                <img
                  src={`data:image/svg+xml;utf-8,${encodeURIComponent(enrolling.qr)}`}
                  alt="2FA setup QR code"
                  className="w-full h-full"
                />
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted font-display text-center">{t('mfaManualSecret')}</p>
            <p className="mt-1 text-[12px] font-display font-bold text-navy text-center tracking-wider break-all">
              {enrolling.secret}
            </p>

            <form onSubmit={confirmEnroll} className="mt-4 space-y-3">
              <label className="label" htmlFor="mfa-code">{t('mfaEnterCode')}</label>
              <input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="input h-11 text-[18px] text-center tracking-[0.4em] font-display font-bold"
                placeholder="000000"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={mfaBusy || mfaCode.trim().length !== 6}
                  className="btn-primary h-9 px-4 text-[13px] flex-1"
                >
                  {mfaBusy ? t('mfaVerifying') : t('mfaConfirm')}
                </button>
                <button type="button" onClick={cancelEnroll} className="btn-ghost h-9 px-4 text-[13px]">
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        )}
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}
      {!db && !error && <Spinner label={t('loadingConfiguration')} />}

      {db && (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card eyebrow={t('rules')} title={t('oaThresholdsTitle')} icon="activity" tone="amber">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">{t('colClass')}</th>
                <th className="th">{t('colMeanThickness')}</th>
              </tr>
            </thead>
            <tbody>
              {THRESHOLDS.map(([labelKey, range, dot]) => (
                <tr key={labelKey} className="row-hover">
                  <td className="td">
                    <span className="inline-flex items-center gap-2 font-display font-medium">
                      <span className={`w-2.5 h-2.5 rounded-full ${dot}`} style={{ border: '1px solid #2D2016' }} />
                      {t(labelKey)}
                    </span>
                  </td>
                  <td className="td font-display">{range}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-4 space-y-1.5 text-[12px] text-muted leading-relaxed font-display">
            <li>{t('thresholdNoteFemale')}</li>
            <li>{t('thresholdNoteAge')}</li>
            <li>{t('thresholdNoteSeed')}</li>
          </ul>
        </Card>

        <Card eyebrow={t('legend')} title={t('overlayColourKey')} icon="layers" tone="blue">
          <div className="space-y-3">
            {[
              ['structFemur', '#E8772E', t('structFemurDesc')],
              ['meniscusLegendLabel', '#2D9F6F', t('structMeniscusDesc')],
              ['structTibia', '#E85D75', t('structTibiaDesc')],
            ].map(([labelKey, color, desc]) => (
              <div key={labelKey} className="flex items-start gap-3">
                <span
                  className="w-8 h-8 rounded-[8px] mt-0.5 shrink-0"
                  style={{ backgroundColor: `${color}22`, border: `2px solid ${color}` }}
                />
                <div>
                  <div className="text-[13px] font-display font-medium text-navy">
                    {labelKey === 'meniscusLegendLabel' ? t('structMeniscus') : t(labelKey)}
                  </div>
                  <div className="text-[12px] text-muted font-display">{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[12px] text-muted leading-relaxed font-display">
            {t('matchingMethodPrefix')} {db.systems.length} {t('matchingMethodSuffix')}
          </p>
        </Card>
      </div>

      <Card
        eyebrow={t('reference')}
        title={t('implantCatalogue')}
        icon="implant"
        tone="blue"
        action={
          <select className="input h-8 w-auto text-[13px]" value={system} onChange={(e) => setSystem(e.target.value)}>
            {db.systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.manufacturer} — {s.system}
              </option>
            ))}
          </select>
        }
      >
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] mb-4 font-display">
          <div><span className="text-muted">{t('typeLabel')} </span><span className="font-medium">{active.type}</span></div>
          <div><span className="text-muted">{t('builtInSlope')} </span><span className="font-medium">{active.built_in_slope}°</span></div>
          <div><span className="text-muted">{t('sizesLabel')} </span><span className="font-medium">{active.sizes.length}</span></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">{t('colSize')}</th>
                <th className="th">{t('femoralMl')}</th>
                <th className="th">{t('femoralAp')}</th>
                <th className="th">{t('tibialMl')}</th>
                <th className="th">{t('tibialAp')}</th>
              </tr>
            </thead>
            <tbody>
              {active.sizes.map((s) => (
                <tr key={s.size} className="row-hover">
                  <td className="td">
                    <span
                      className="inline-flex items-center justify-center min-w-[34px] h-7 px-2 rounded-[8px]
                                 bg-page text-[12px] font-display font-bold text-navy"
                      style={{ border: '2px solid #2D2016' }}
                    >{s.size}</span>
                  </td>
                  <td className="td font-display">{s.femoral_ml} mm</td>
                  <td className="td font-display">{s.femoral_ap} mm</td>
                  <td className="td font-display">{s.tibial_ml} mm</td>
                  <td className="td font-display">{s.tibial_ap} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] text-muted font-display">{db.meta.note}</p>
      </Card>
      </>
      )}
    </div>
  )
}
