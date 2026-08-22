import { useEffect, useState } from 'react'
import { getImplants } from '../lib/api'
import { Card, ErrorNote, Spinner } from '../components/ui'

const THRESHOLDS = [
  ['Severe OA', '< 3.0 mm', 'bg-danger'],
  ['Moderate OA', '3.0 – 4.0 mm', 'bg-warn'],
  ['Mild OA', '4.0 – 5.0 mm', 'bg-accent'],
  ['Normal', '> 5.0 mm', 'bg-ok'],
]

export default function Settings() {
  const [db, setDb] = useState(null)
  const [error, setError] = useState('')
  const [system, setSystem] = useState(null)

  useEffect(() => {
    getImplants()
      .then((d) => {
        setDb(d)
        setSystem(d.systems[0].id)
      })
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!db) return <Spinner label="Loading configuration…" />

  const active = db.systems.find((s) => s.id === system)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Settings</h2>
        <p className="text-[13px] text-muted mt-1">
          Classification thresholds and the implant catalogue used for size matching.
        </p>
      </div>

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
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span className={`w-2 h-2 rounded-full ${dot}`} />
                      {label}
                    </span>
                  </td>
                  <td className="td">{range}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-4 space-y-1.5 text-[12px] text-muted leading-relaxed">
            <li>Female patients: every threshold shifts down by 0.3 mm.</li>
            <li>Age &gt; 60: severity is escalated by one grade.</li>
            <li>Results are seeded from the SHA-256 hash of the uploaded image, so a given image always yields identical output.</li>
          </ul>
        </Card>

        <Card eyebrow="Legend" title="Overlay Colour Key" icon="layers" tone="blue">
          <div className="space-y-3">
            {[
              ['Femur', '#3B82F6', 'Distal femur zone, drawn above the joint line.'],
              ['Medial Meniscus', '#10B981', 'Joint-space zone with the three calliper measurements.'],
              ['Tibia', '#EF4444', 'Proximal tibia zone with the ML width and slope indicator.'],
            ].map(([label, color, desc]) => (
              <div key={label} className="flex items-start gap-3">
                <span
                  className="w-8 h-8 rounded-lg mt-0.5 shrink-0 ring-1"
                  style={{ backgroundColor: `${color}1A`, borderColor: color, boxShadow: `inset 0 0 0 1px ${color}55` }}
                >
                  <span className="block w-full h-full rounded-lg" style={{ backgroundColor: `${color}22` }} />
                </span>
                <div>
                  <div className="text-[13px] font-medium text-navy">{label}</div>
                  <div className="text-[12px] text-muted">{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[12px] text-muted leading-relaxed">
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
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] mb-4">
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
                    <span className="inline-flex items-center justify-center min-w-[34px] h-7 px-2 rounded-lg
                                     bg-page ring-1 ring-line text-[12px] font-bold text-navy">{s.size}</span>
                  </td>
                  <td className="td">{s.femoral_ml} mm</td>
                  <td className="td">{s.femoral_ap} mm</td>
                  <td className="td">{s.tibial_ml} mm</td>
                  <td className="td">{s.tibial_ap} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] text-muted">{db.meta.note}</p>
      </Card>
    </div>
  )
}
