import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getAnalysis, downloadReport } from '../lib/api'
import {
  Card, CompareBar, Disclaimer, ErrorNote, Gauge, SeverityBadge, Spinner, Tile,
} from '../components/ui'
import Icon, { IconChip } from '../components/Icon'
import Viewer from '../components/Viewer'
import { ConfidenceBars, ThicknessComparison, ThicknessRadar } from '../components/Charts'

const KL_COLOR = ['#2D9F6F', '#E8772E', '#D4A017', '#E85D75', '#E85D75']

function PatientHeader({ result }) {
  const p = result.patient
  const fields = [
    ['Age', p.age],
    ['Sex', p.sex],
    ['Imaging', p.imaging_type],
    ['Side', `${p.affected_side} knee`],
    ['Analysed', result.created_at.replace('T', ' ')],
  ]

  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadReport(result)
    } catch (e) {
      alert('Failed to download report: ' + e.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-4 min-w-0">
          <span
            className="w-12 h-12 rounded-[10px] bg-accent text-white flex items-center justify-center
                         text-[15px] font-display font-bold shrink-0"
            style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}
          >
            {p.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[24px] font-display font-bold text-navy tracking-[-0.02em] leading-tight">{p.name}</h2>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {fields.map(([k, v]) => (
                <div key={k} className="text-[13px] text-muted font-display">
                  {k} <span className="text-body font-semibold ml-0.5">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button className="btn-dark" onClick={handleDownload} disabled={downloading}>
          <Icon name="download" size={15} />
          {downloading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      <div
        className="px-5 sm:px-6 py-3 bg-page/60 flex flex-wrap
                    items-center gap-x-5 gap-y-1.5 text-[11px] text-muted font-display"
        style={{ borderTop: '2px solid #2D2016' }}
      >
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
                <span className="font-display font-semibold text-navy">{r.label}</span>
              </td>
              <td className="td">
                <span className="text-[15px] font-display font-bold text-navy">{r.patient.toFixed(1)}</span>
                <span className="text-muted text-[12px] ml-1">mm</span>
              </td>
              <td className="td">
                <CompareBar
                  value={r.patient}
                  reference={isFemale ? r.population_female : r.population_male}
                  max={7}
                />
              </td>
              <td className="td text-muted font-display">{r.population_male.toFixed(1)} mm</td>
              <td className="td text-muted font-display">{r.population_female.toFixed(1)} mm</td>
              <td className="td">
                <span className={r.deviation_mm < 0 ? 'pill-neg' : 'pill-pos'}>
                  {r.deviation_mm > 0 ? '+' : ''}{r.deviation_mm.toFixed(2)} mm
                  <span className="opacity-70 ml-1">({r.deviation_pct > 0 ? '+' : ''}{r.deviation_pct}%)</span>
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
                      'w-7 h-7 rounded-[8px] flex items-center justify-center text-[11px] font-display font-bold',
                      i === 0 ? 'bg-accent text-white' : 'bg-ink-100 text-muted',
                    ].join(' ')}
                    style={{ border: '2px solid #2D2016' }}
                  >
                    {i + 1}
                  </span>
                  <span className={i === 0 ? 'font-display font-bold text-accent' : 'font-display font-medium text-muted'}>
                    {r.rank}
                  </span>
                </span>
              </td>
              <td className="td">
                <div className="font-display font-bold text-navy">{r.manufacturer}</div>
                <div className="text-muted text-[11px] mt-0.5">{r.system} · {r.type}</div>
              </td>
              <td className="td">
                <span
                  className="inline-flex items-center justify-center min-w-[34px] h-7 px-2
                             rounded-[8px] bg-page text-[12px] font-display font-bold text-navy"
                  style={{ border: '2px solid #2D2016' }}
                >
                  {r.size}
                </span>
              </td>
              <td className="td tnum font-display">{r.dimensions.femoral_ml} / {r.dimensions.femoral_ap} mm</td>
              <td className="td tnum font-display">{r.dimensions.tibial_ml} / {r.dimensions.tibial_ap} mm</td>
              <td className="td text-muted text-[12px] tnum font-display">{r.max_abs_delta_mm} mm</td>
              <td className="td">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-[60px] h-2 rounded-full bg-ink-100 overflow-hidden shrink-0"
                    style={{ border: '1px solid #2D2016' }}
                  >
                    <div
                      className={i === 0 ? 'h-full rounded-full bg-accent' : 'h-full rounded-full bg-ink-300'}
                      style={{ width: `${r.confidence_pct}%` }}
                    />
                  </div>
                  <span className="font-display font-bold text-navy tnum">{r.confidence_pct}%</span>
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
      <PatientHeader result={result} />

      {/* ═══════════════════════════════════════════════════════
          MODULE 1 — OA Assessment
          ═══════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ok text-white text-[12px] font-display font-bold uppercase tracking-wider"
            style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}
          >
            Module 1 — OA Assessment
          </span>
        </div>

        {/* metric row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Tile
            label="OA Assessment"
            icon="activity"
            tone={a.classification === 'Normal' ? 'green' : a.classification === 'Severe OA' ? 'red' : 'amber'}
            footer={
              <p className="card-sub font-display">
                {a.age_escalated
                  ? `Escalated from ${a.base_classification} · age > 60`
                  : a.sex_adjusted
                    ? 'Sex-adjusted thresholds applied'
                    : `Age band ${a.age_band || '<40'} · standard thresholds`}
              </p>
            }
          >
            <SeverityBadge value={a.classification} size="lg" />
            <div className="mt-5 flex gap-1.5">
              {['Normal', 'Mild OA', 'Moderate OA', 'Severe OA'].map((step, i) => {
                const active = ['Normal', 'Mild OA', 'Moderate OA', 'Severe OA'].indexOf(a.classification) >= i
                const colors = ['#2D9F6F', '#E8772E', '#D4A017', '#E85D75']
                return (
                  <span
                    key={step}
                    title={step}
                    className="h-2 flex-1 rounded-full transition-colors duration-200"
                    style={{
                      backgroundColor: active ? colors[i] : '#E8DCC8',
                      border: '1px solid #2D2016',
                    }}
                  />
                )
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted font-display">
              Severity scale · Normal → Severe
            </p>
          </Tile>

          <Tile
            label="KL Grade"
            icon="layers"
            tone="amber"
            footer={<p className="card-sub font-display">{kl.description}</p>}
          >
            <div className="flex items-center gap-4">
              <Gauge value={kl.grade} max={4} color={KL_COLOR[kl.grade]} label="of 4" />
              <div className="space-y-1">
                {[0, 1, 2, 3, 4].map((g) => (
                  <div key={g} className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: g === kl.grade ? KL_COLOR[g] : '#E8DCC8' }}
                    />
                    <span className={`text-[11px] font-display ${g === kl.grade ? 'text-navy font-semibold' : 'text-ink-300'}`}>
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
              <p className="card-sub font-display">
                Minimum {a.min_thickness_mm.toFixed(1)} mm across the three locations
              </p>
            }
          >
            <div className="metric">
              {a.mean_thickness_mm.toFixed(2)}
              <span className="text-[15px] font-semibold text-muted ml-1.5 tracking-normal">mm</span>
            </div>
            <div
              className="mt-4 h-2 rounded-full bg-ink-100 overflow-hidden"
              style={{ border: '1px solid #2D2016' }}
            >
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.min(a.mean_thickness_mm / 7, 1) * 100}%` }}
              />
            </div>
          </Tile>
        </div>

        {/* Meniscus detail card */}
        <Card
          eyebrow="Meniscus Analysis"
          title="Medial Meniscus Thickness"
          icon="ruler"
          tone="green"
          action={<SeverityBadge value={a.classification} />}
        >
          <MeniscusTable rows={result.meniscus.population_comparison} sex={result.patient.sex} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className="rounded-[12px] p-4" style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}>
              <p className="eyebrow mb-4">Patient vs population means</p>
              <ThicknessComparison rows={result.meniscus.population_comparison} />
            </div>
            <div className="rounded-[12px] p-4" style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}>
              <p className="eyebrow mb-4">Profile shape</p>
              <ThicknessRadar rows={result.meniscus.population_comparison} sex={result.patient.sex} />
            </div>
          </div>

          <ul className="mt-6 space-y-2.5">
            {a.rationale.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12px] text-muted leading-relaxed font-display">
                <Icon name="check" size={13} className="text-ok mt-[3px] shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════
          IMAGING VISUALIZATION (between the two modules)
          ═══════════════════════════════════════════════════════ */}
      <Viewer result={result} />

      {/* ═══════════════════════════════════════════════════════
          MODULE 2 — Implant Sizing
          ═══════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent text-white text-[12px] font-display font-bold uppercase tracking-wider"
            style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}
          >
            Module 2 — Implant Sizing
          </span>
        </div>

        {/* Primary implant quick view */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Tile
            label="Primary Implant"
            icon="implant"
            tone="blue"
            footer={
              <div className="flex items-center justify-between gap-2">
                <span className="card-sub truncate font-display">{primary.system}</span>
                <span className="pill-pos shrink-0">{primary.confidence_pct}% match</span>
              </div>
            }
          >
            <div className="text-[22px] font-display font-bold text-accent tracking-[-0.02em] leading-tight">
              {primary.manufacturer.split(' ')[0]}
              <span className="text-navy ml-2">{primary.size}</span>
            </div>
            <p className="mt-2 text-[12px] text-muted font-display">{primary.type}</p>
          </Tile>

          <div className="card card-pad">
            <p className="eyebrow mb-3">Bone Measurements</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                ['Femoral ML', bones.femoral_ml_mm, 'mm'],
                ['Femoral AP', bones.femoral_ap_mm, 'mm'],
                ['Tibial ML', bones.tibial_ml_mm, 'mm'],
                ['Tibial AP', bones.tibial_ap_mm, 'mm'],
                ['Tibial Slope', bones.tibial_slope_deg, '°'],
              ].map(([k, v, u]) => (
                <div
                  key={k}
                  className="rounded-[10px] bg-page px-3 py-2.5
                             transition-colors duration-150 hover:bg-surface"
                  style={{ border: '2px solid #2D2016' }}
                >
                  <div className="eyebrow text-[9px]">{k}</div>
                  <div className="mt-1 text-[18px] font-display font-bold text-navy leading-none tnum">
                    {v}<span className="text-[11px] font-semibold text-muted ml-1">{u}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Card eyebrow="Implant Catalogue" title="Implant Size Matching" icon="implant" tone="blue">
          <ImplantTable implant={result.implant} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 items-start">
            <div className="rounded-[12px] p-4" style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}>
              <p className="eyebrow mb-4">Match confidence</p>
              <ConfidenceBars candidates={candidates} />
            </div>
            <div className="space-y-3">
              {[
                ['ruler', result.implant.slope_note],
                ['layers', result.implant.method],
              ].map(([icon, text]) => (
                <div
                  key={text}
                  className="flex items-start gap-3 rounded-[12px] bg-page p-3.5"
                  style={{ border: '2px solid #2D2016' }}
                >
                  <IconChip name={icon} size="sm" />
                  <p className="text-[12px] text-muted leading-relaxed font-display">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Disclaimer />
    </div>
  )
}
