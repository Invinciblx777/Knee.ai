import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getAnalysis, reportUrl } from '../lib/api'
import {
  Card, CompareBar, DemoBanner, Disclaimer, ErrorNote, Gauge, ModeBadge, SeverityBadge, Spinner, Tile,
} from '../components/ui'
import Icon, { IconChip } from '../components/Icon'
import Viewer from '../components/Viewer'
import { ConfidenceBars, ThicknessComparison, ThicknessRadar } from '../components/Charts'

const KL_COLOR = ['#10B981', '#3B82F6', '#F59E0B', '#F97316', '#EF4444']

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
    <div className="card overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-4 min-w-0">
          <span className="w-12 h-12 rounded-xl2 bg-navy text-white flex items-center justify-center
                           text-[15px] font-bold shrink-0">
            {p.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[24px] font-bold text-navy tracking-[-0.02em] leading-tight">{p.name}</h2>
              <ModeBadge mode={result.mode} label={result.mode_label} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {fields.map(([k, v]) => (
                <div key={k} className="text-[13px] text-muted">
                  {k} <span className="text-body font-semibold ml-0.5">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <a className="btn-dark" href={reportUrl(result.analysis_id)} target="_blank" rel="noreferrer">
          <Icon name="download" size={15} />
          Generate Report
        </a>
      </div>

      <div className="px-5 sm:px-6 py-3 border-t border-line bg-page/60 flex flex-wrap
                      items-center gap-x-5 gap-y-1.5 text-[11px] text-muted">
        <span className="font-mono">ID {result.analysis_id}</span>
        <span className="font-mono">hash {result.image_hash.slice(0, 16)}…</span>
        {result.provenance && (
          <span className="flex items-center gap-1.5">
            <Icon name="layers" size={12} className="text-ink-300" />
            {result.provenance.method}
            {result.sample_source ? ` · ${result.sample_source}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}

function MeniscusTable({ rows, sex }) {
  const isFemale = sex === 'Female'
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="th">Location</th>
            <th className="th">Patient</th>
            <th className="th">vs population</th>
            <th className="th">Male mean</th>
            <th className="th">Female mean</th>
            <th className="th">Deviation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.location} className="row-hover">
              <td className="td">
                <span className="font-semibold text-navy">{r.label}</span>
              </td>
              <td className="td">
                <span className="text-[15px] font-bold text-navy">{r.patient.toFixed(1)}</span>
                <span className="text-muted text-[12px] ml-1">mm</span>
              </td>
              <td className="td">
                <CompareBar
                  value={r.patient}
                  reference={isFemale ? r.population_female : r.population_male}
                  max={7}
                />
              </td>
              <td className="td text-muted">{r.population_male.toFixed(1)} mm</td>
              <td className="td text-muted">{r.population_female.toFixed(1)} mm</td>
              <td className="td">
                <span className={r.deviation_mm < 0 ? 'pill-neg' : 'pill-pos'}>
                  {r.deviation_mm > 0 ? '+' : ''}{r.deviation_mm.toFixed(2)} mm
                  <span className="opacity-70">({r.deviation_pct > 0 ? '+' : ''}{r.deviation_pct}%)</span>
                </span>
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
            <tr
              key={`${r.system_id}-${r.size}`}
              className={`row-hover ${i === 0 ? 'bg-accent-light/60' : ''}`}
            >
              <td className="td">
                <span className="flex items-center gap-2.5">
                  <span
                    className={[
                      'w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold',
                      i === 0 ? 'bg-accent text-white' : 'bg-ink-100 text-muted',
                    ].join(' ')}
                  >
                    {i + 1}
                  </span>
                  <span className={i === 0 ? 'font-bold text-accent' : 'font-medium text-muted'}>
                    {r.rank}
                  </span>
                </span>
              </td>
              <td className="td">
                <div className="font-bold text-navy">{r.manufacturer}</div>
                <div className="text-muted text-[11px] mt-0.5">{r.system} · {r.type}</div>
              </td>
              <td className="td">
                <span className="inline-flex items-center justify-center min-w-[34px] h-7 px-2
                                 rounded-lg bg-page ring-1 ring-line text-[12px] font-bold text-navy">
                  {r.size}
                </span>
              </td>
              <td className="td tnum">{r.dimensions.femoral_ml} / {r.dimensions.femoral_ap} mm</td>
              <td className="td tnum">{r.dimensions.tibial_ml} / {r.dimensions.tibial_ap} mm</td>
              <td className="td text-muted text-[12px] tnum">{r.max_abs_delta_mm} mm</td>
              <td className="td">
                <div className="flex items-center gap-2.5">
                  <div className="w-[60px] h-1.5 rounded-full bg-ink-100 overflow-hidden shrink-0">
                    <div
                      className={i === 0 ? 'h-full rounded-full bg-accent' : 'h-full rounded-full bg-ink-300'}
                      style={{ width: `${r.confidence_pct}%` }}
                    />
                  </div>
                  <span className="font-bold text-navy tnum">{r.confidence_pct}%</span>
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
  const primary = result.implant.primary
  const candidates = [primary, ...result.implant.alternatives]

  return (
    <div className="space-y-8 animate-fade-up">
      <DemoBanner text={result.demo_banner} />

      <PatientHeader result={result} />

      {/* --- metric row --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Tile
          label="OA Assessment"
          icon="activity"
          tone={a.classification === 'Normal' ? 'green' : a.classification === 'Severe OA' ? 'red' : 'amber'}
          footer={
            <p className="card-sub">
              {a.age_escalated
                ? `Escalated from ${a.base_classification} · age > 60`
                : 'No age escalation applied'}
            </p>
          }
        >
          <SeverityBadge value={a.classification} size="lg" />
          <div className="mt-5 flex gap-1.5">
            {['Normal', 'Mild OA', 'Moderate OA', 'Severe OA'].map((step, i) => {
              const active = ['Normal', 'Mild OA', 'Moderate OA', 'Severe OA'].indexOf(a.classification) >= i
              const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444']
              return (
                <span
                  key={step}
                  title={step}
                  className="h-1.5 flex-1 rounded-full transition-colors duration-200"
                  style={{ backgroundColor: active ? colors[i] : '#F1F5F9' }}
                />
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Severity scale · Normal → Severe
          </p>
        </Tile>

        <Tile
          label="KL Grade"
          icon="layers"
          tone="amber"
          footer={<p className="card-sub">{kl.description}</p>}
        >
          <div className="flex items-center gap-4">
            <Gauge value={kl.grade} max={4} color={KL_COLOR[kl.grade]} label="of 4" />
            <div className="space-y-1">
              {[0, 1, 2, 3, 4].map((g) => (
                <div key={g} className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: g === kl.grade ? KL_COLOR[g] : '#E2E8F0' }}
                  />
                  <span className={`text-[11px] ${g === kl.grade ? 'text-navy font-semibold' : 'text-ink-300'}`}>
                    KL{g}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Tile>

        <Tile
          label="Mean Meniscus Thickness"
          icon="ruler"
          tone="blue"
          footer={
            <p className="card-sub">
              Minimum {a.min_thickness_mm.toFixed(1)} mm across the three locations
            </p>
          }
        >
          <div className="metric">
            {a.mean_thickness_mm.toFixed(2)}
            <span className="text-[15px] font-semibold text-muted ml-1.5 tracking-normal">mm</span>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-ink-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(a.mean_thickness_mm / 7, 1) * 100}%` }}
            />
          </div>
        </Tile>

        <Tile
          label="Primary Implant"
          icon="implant"
          tone="blue"
          footer={
            <div className="flex items-center justify-between gap-2">
              <span className="card-sub truncate">{primary.system}</span>
              <span className="pill-pos shrink-0">{primary.confidence_pct}% match</span>
            </div>
          }
        >
          <div className="text-[22px] font-bold text-accent tracking-[-0.02em] leading-tight">
            {primary.manufacturer.split(' ')[0]}
            <span className="text-navy ml-2">{primary.size}</span>
          </div>
          <p className="mt-2 text-[12px] text-muted">{primary.type}</p>
        </Tile>
      </div>

      <Viewer result={result} />

      {/* --- module 1 --- */}
      <Card
        eyebrow="Module 01"
        title="Medial Meniscus Thickness"
        icon="ruler"
        tone="green"
        action={<SeverityBadge value={a.classification} />}
      >
        <MeniscusTable rows={result.meniscus.population_comparison} sex={result.patient.sex} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <div className="rounded-[10px] ring-1 ring-line p-4">
            <p className="eyebrow mb-4">Patient vs population means</p>
            <ThicknessComparison rows={result.meniscus.population_comparison} />
          </div>
          <div className="rounded-[10px] ring-1 ring-line p-4">
            <p className="eyebrow mb-4">Profile shape</p>
            <ThicknessRadar rows={result.meniscus.population_comparison} sex={result.patient.sex} />
          </div>
        </div>

        <ul className="mt-6 space-y-2.5">
          {a.rationale.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[12px] text-muted leading-relaxed">
              <Icon name="check" size={13} className="text-ok mt-[3px] shrink-0" />
              {r}
            </li>
          ))}
        </ul>
      </Card>

      {/* --- module 2 --- */}
      <Card eyebrow="Module 02" title="Implant Sizing" icon="implant" tone="blue">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Femoral ML', bones.femoral_ml_mm, 'mm'],
            ['Femoral AP', bones.femoral_ap_mm, 'mm'],
            ['Tibial ML', bones.tibial_ml_mm, 'mm'],
            ['Tibial AP', bones.tibial_ap_mm, 'mm'],
            ['Tibial Slope', bones.tibial_slope_deg, '°'],
          ].map(([k, v, u]) => (
            <div
              key={k}
              className="rounded-[10px] ring-1 ring-line bg-page/50 px-4 py-3.5
                         transition-colors duration-150 hover:bg-surface hover:ring-line-strong"
            >
              <div className="eyebrow">{k}</div>
              <div className="mt-2 text-[22px] font-bold text-navy leading-none tracking-[-0.02em] tnum">
                {v}<span className="text-[12px] font-semibold text-muted ml-1 tracking-normal">{u}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <ImplantTable implant={result.implant} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 items-start">
          <div className="rounded-[10px] ring-1 ring-line p-4">
            <p className="eyebrow mb-4">Match confidence</p>
            <ConfidenceBars candidates={candidates} />
          </div>
          <div className="space-y-3">
            {[
              ['ruler', result.implant.slope_note],
              ['layers', result.implant.method],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-start gap-3 rounded-[10px] bg-page/60 ring-1 ring-line p-3.5">
                <IconChip name={icon} size="sm" />
                <p className="text-[12px] text-muted leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Disclaimer />
    </div>
  )
}
