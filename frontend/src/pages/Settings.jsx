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

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
  }

  useEffect(() => {
    getImplants()
      .then((d) => {
        setDb(d)
        setSystem(d.systems[0].id)
      })
      .catch((e) => setError(e.message))
  }, [])

  const active = db && db.systems.find((s) => s.id === system)

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
