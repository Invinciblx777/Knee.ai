import { useContext, useEffect, useState } from 'react'
import { getImplants } from '../lib/api'
import { supabase } from '../lib/supabase'
import { AuthContext } from '../App'
import { useLanguage } from '../lib/LanguageContext'
import { Card, ErrorNote, Spinner } from '../components/ui'
import Icon from '../components/Icon'

const THRESHOLDS = [
  ['Severe OA', '< 3.0 mm', 'bg-danger'],
  ['Moderate OA', '3.0 – 4.0 mm', 'bg-warn'],
  ['Mild OA', '4.0 – 5.0 mm', 'bg-accent'],
  ['Normal', '> 5.0 mm', 'bg-ok'],
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
        <h2 className="page-title">Settings</h2>
        <p className="text-[13px] text-muted mt-1 font-display">
          Classification thresholds and the implant catalogue used for size matching.
        </p>
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
      {!db && !error && <Spinner label="Loading configuration…" />}

      {db && (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card eyebrow="Rules" title="OA Classification Thresholds" icon="activity" tone="amber">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Class</th>
                <th className="th">Mean meniscus thickness</th>
              </tr>
            </thead>
            <tbody>
              {THRESHOLDS.map(([label, range, dot]) => (
                <tr key={label} className="row-hover">
                  <td className="td">
                    <span className="inline-flex items-center gap-2 font-display font-medium">
                      <span className={`w-2.5 h-2.5 rounded-full ${dot}`} style={{ border: '1px solid #2D2016' }} />
                      {label}
                    </span>
                  </td>
                  <td className="td font-display">{range}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-4 space-y-1.5 text-[12px] text-muted leading-relaxed font-display">
            <li>Female patients: every threshold shifts down by 0.3 mm.</li>
            <li>Age-band adjustments: 40-50 (−0.15 mm), 50-60 (−0.35 mm), &gt;60 (−0.55 mm + one grade escalation).</li>
            <li>Results are seeded from the SHA-256 hash of the uploaded image for reproducibility.</li>
          </ul>
        </Card>

        <Card eyebrow="Legend" title="Overlay Colour Key" icon="layers" tone="blue">
          <div className="space-y-3">
            {[
              ['Femur', '#E8772E', 'Distal femur zone, drawn above the joint line.'],
              ['Medial Meniscus', '#2D9F6F', 'Joint-space zone with the three calliper measurements.'],
              ['Tibia', '#E85D75', 'Proximal tibia zone with the ML width and slope indicator.'],
            ].map(([label, color, desc]) => (
              <div key={label} className="flex items-start gap-3">
                <span
                  className="w-8 h-8 rounded-[8px] mt-0.5 shrink-0"
                  style={{ backgroundColor: `${color}22`, border: `2px solid ${color}` }}
                />
                <div>
                  <div className="text-[13px] font-display font-medium text-navy">{label}</div>
                  <div className="text-[12px] text-muted font-display">{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[12px] text-muted leading-relaxed font-display">
            Matching method: {db.systems.length} implant systems × 5 sizes, ranked by euclidean
            distance across femoral ML/AP and tibial ML/AP.
          </p>
        </Card>
      </div>

      <Card
        eyebrow="Reference"
        title="Implant Catalogue"
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
          <div><span className="text-muted">Type: </span><span className="font-medium">{active.type}</span></div>
          <div><span className="text-muted">Built-in slope: </span><span className="font-medium">{active.built_in_slope}°</span></div>
          <div><span className="text-muted">Sizes: </span><span className="font-medium">{active.sizes.length}</span></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Size</th>
                <th className="th">Femoral ML</th>
                <th className="th">Femoral AP</th>
                <th className="th">Tibial ML</th>
                <th className="th">Tibial AP</th>
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
