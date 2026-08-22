import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getAnalysis, reportUrl } from '../lib/api'
import { Card, DemoBanner, Disclaimer, ErrorNote, ModeBadge, SeverityBadge, Spinner, Stat } from '../components/ui'
import Viewer from '../components/Viewer'
import { ConfidenceBars, ThicknessComparison, ThicknessRadar } from '../components/Charts'

const KL_TONE = ['good', 'good', 'accent', 'bad', 'bad']

function PatientHeader({ result }) {
  const p = result.patient
  const fields = [
    ['Age', p.age],
    ['Sex', p.sex],
    ['Imaging', p.imaging_type],
    ['Side', `${p.affected_side} knee`],
    ['Analysed', result.created_at.replace('T', ' ')],
  ]
  return (
    <div className="card card-pad flex flex-wrap items-start justify-between gap-5">
      <div>
        <h2 className="text-[20px] font-semibold text-navy">{p.name}</h2>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
          {fields.map(([k, v]) => (
            <div key={k} className="text-[13px]">
              <span className="text-muted">{k}: </span>
              <span className="text-navy font-medium">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted font-mono">
          ID {result.analysis_id} · image hash {result.image_hash.slice(0, 16)}…
        </p>
        {result.provenance && (
          <p className="mt-1 text-[11px] text-muted">
            {result.provenance.method}
            {result.sample_source ? ` · ${result.sample_source}` : ''}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2.5">
        <ModeBadge mode={result.mode} label={result.mode_label} />
        <a className="btn-dark" href={reportUrl(result.analysis_id)} target="_blank" rel="noreferrer">
          Generate Report
        </a>
      </div>
    </div>
  )
}

function MeniscusTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="th">Location</th>
            <th className="th">Patient</th>
            <th className="th">Male mean</th>
            <th className="th">Female mean</th>
            <th className="th">Deviation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.location} className="row-hover">
              <td className="td font-medium">{r.label}</td>
              <td className="td">{r.patient.toFixed(1)} mm</td>
              <td className="td text-muted">{r.population_male.toFixed(1)} mm</td>
              <td className="td text-muted">{r.population_female.toFixed(1)} mm</td>
              <td className={`td font-medium ${r.deviation_mm < 0 ? 'text-danger' : 'text-ok'}`}>
                {r.deviation_mm > 0 ? '+' : ''}{r.deviation_mm.toFixed(2)} mm
                <span className="text-muted font-normal"> ({r.deviation_pct > 0 ? '+' : ''}{r.deviation_pct}%)</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ImplantTable({ implant }) {
  const rows = [
    { rank: 'Primary', ...implant.primary },
    ...implant.alternatives.map((a, i) => ({ rank: `Alternative ${i + 1}`, ...a })),
  ]
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="th">Rank</th>
            <th className="th">Manufacturer / System</th>
            <th className="th">Size</th>
            <th className="th">Femoral ML / AP</th>
            <th className="th">Tibial ML / AP</th>
            <th className="th">Δ max</th>
            <th className="th">Match</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.system_id}-${r.size}`} className={`row-hover ${i === 0 ? 'bg-accent/[0.04]' : ''}`}>
              <td className="td font-medium">{r.rank}</td>
              <td className="td">
                <div className="font-medium">{r.system}</div>
                <div className="text-muted text-[12px]">{r.manufacturer} · {r.type}</div>
              </td>
              <td className="td font-semibold">{r.size}</td>
              <td className="td">{r.dimensions.femoral_ml} / {r.dimensions.femoral_ap} mm</td>
              <td className="td">{r.dimensions.tibial_ml} / {r.dimensions.tibial_ap} mm</td>
              <td className="td text-muted">{r.max_abs_delta_mm} mm</td>
              <td className="td">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-line overflow-hidden">
                    <div
                      className={i === 0 ? 'h-full bg-accent' : 'h-full bg-navy/30'}
                      style={{ width: `${r.confidence_pct}%` }}
                    />
                  </div>
                  <span className="font-semibold">{r.confidence_pct}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Results() {
  const { id } = useParams()
  const { state } = useLocation()
  const [result, setResult] = useState(state?.result ?? null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (result && result.analysis_id === id) return
    getAnalysis(id).then(setResult).catch((e) => setError(e.message))
  }, [id])

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <Link to="/new" className="btn-primary">Start a new analysis</Link>
      </div>
    )
  }
  if (!result) return <Spinner label="Loading analysis…" />

  const a = result.meniscus.assessment
  const kl = result.meniscus.kl_grade
  const bones = result.bone_measurements
  const candidates = [result.implant.primary, ...result.implant.alternatives]

  return (
    <div className="space-y-6">
      <DemoBanner text={result.demo_banner} />
      <PatientHeader result={result} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-pad">
          <div className="card-title">OA Assessment</div>
          <div className="mt-2.5"><SeverityBadge value={a.classification} size="lg" /></div>
          <p className="mt-2 text-[12px] text-muted">
            {a.age_escalated ? `Escalated from ${a.base_classification} (age > 60)` : 'No age escalation applied'}
          </p>
        </div>
        <Stat
          label="KL Grade" value={kl.grade} unit="/ 4" tone={KL_TONE[kl.grade]}
          hint={kl.description}
        />
        <Stat
          label="Mean Meniscus Thickness" value={a.mean_thickness_mm.toFixed(2)} unit="mm"
          hint={`Minimum ${a.min_thickness_mm.toFixed(1)} mm across the three locations`}
        />
        <Stat
          label="Primary Implant"
          value={`${result.implant.primary.manufacturer.split(' ')[0]} ${result.implant.primary.size}`}
          tone="accent"
          hint={`${result.implant.primary.system} · ${result.implant.primary.confidence_pct}% match`}
        />
      </div>

      <Viewer result={result} />

      <Card title="Module 1 — Medial Meniscus Thickness">
        <MeniscusTable rows={result.meniscus.population_comparison} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div>
            <p className="card-title mb-2">Patient vs population means</p>
            <ThicknessComparison rows={result.meniscus.population_comparison} sex={result.patient.sex} />
          </div>
          <div>
            <p className="card-title mb-2">Profile shape</p>
            <ThicknessRadar rows={result.meniscus.population_comparison} sex={result.patient.sex} />
          </div>
        </div>
        <ul className="mt-5 space-y-1.5">
          {a.rationale.map((r, i) => (
            <li key={i} className="text-[12px] text-muted leading-relaxed pl-3.5 relative before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-line">
              {r}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Module 2 — Implant Sizing">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Femoral ML', bones.femoral_ml_mm, 'mm'],
            ['Femoral AP', bones.femoral_ap_mm, 'mm'],
            ['Tibial ML', bones.tibial_ml_mm, 'mm'],
            ['Tibial AP', bones.tibial_ap_mm, 'mm'],
            ['Tibial Slope', bones.tibial_slope_deg, '°'],
          ].map(([k, v, u]) => (
            <div key={k} className="rounded-card border border-line px-3.5 py-3">
              <div className="text-[11px] uppercase tracking-wide text-muted font-semibold">{k}</div>
              <div className="text-[19px] font-semibold text-navy mt-1">
                {v}<span className="text-[12px] text-muted ml-0.5">{u}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <ImplantTable implant={result.implant} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 items-start">
          <div>
            <p className="card-title mb-2">Match confidence</p>
            <ConfidenceBars candidates={candidates} />
          </div>
          <div className="space-y-3 text-[12px] text-muted leading-relaxed">
            <p>{result.implant.slope_note}</p>
            <p>{result.implant.method}</p>
          </div>
        </div>
      </Card>

      <Disclaimer />
    </div>
  )
}
