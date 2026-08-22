import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAnalyses } from '../lib/api'
import { Card, Empty, ErrorNote, ModeBadge, SeverityBadge, Spinner, Stat } from '../components/ui'
import Icon from '../components/Icon'

export default function Dashboard() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listAnalyses().then((d) => setItems(d.items)).catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!items) return <Spinner label="Loading dashboard…" />

  const total = items.length
  const severe = items.filter((i) => i.classification === 'Severe OA').length
  const meanKL = total ? (items.reduce((s, i) => s + i.kl_grade, 0) / total).toFixed(1) : '—'
  const meanConf = total ? (items.reduce((s, i) => s + i.confidence_pct, 0) / total).toFixed(1) : '—'
  const recent = items.slice(0, 6)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="text-[13px] text-muted mt-1">
            Medial meniscus OA assessment and patient-specific implant sizing.
          </p>
        </div>
        <Link to="/new" className="btn-primary"><Icon name="scan" size={15} />New Analysis</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Analyses Run" value={total} icon="layers" />
        <Stat label="Severe OA Cases" value={severe} tone={severe ? 'bad' : 'good'} icon="activity"
              hint={total ? `${((severe / total) * 100).toFixed(0)}% of the cohort` : 'No cases yet'} />
        <Stat label="Mean KL Grade" value={meanKL} unit="/ 4" icon="ruler" tone="amber" />
        <Stat label="Mean Implant Match" value={meanConf} unit="%" tone="accent" icon="implant" />
      </div>

      {total === 0 ? (
        <Empty
          title="No analyses yet"
          body="Upload a knee X-ray or MRI with patient details to generate a meniscus assessment and implant sizing recommendation."
          cta={{ to: '/new', label: 'Run your first analysis' }}
        />
      ) : (
        <Card
          eyebrow="Activity"
          title="Recent Analyses"
          icon="history"
          action={
            <Link to="/history" className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent">
              View all <Icon name="chevron" size={13} />
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Patient</th>
                  <th className="th">Mode</th>
                  <th className="th">Side</th>
                  <th className="th">Assessment</th>
                  <th className="th">KL</th>
                  <th className="th">Primary Implant</th>
                  <th className="th">Match</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.analysis_id} className="row-hover">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-page ring-1 ring-line flex items-center
                                         justify-center text-[11px] font-bold text-muted shrink-0">
                          {r.patient.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <div className="font-semibold text-navy">{r.patient.name}</div>
                          <div className="text-muted text-[11px]">
                            {r.patient.age} · {r.patient.sex} · {r.patient.imaging_type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="td"><ModeBadge mode={r.mode} label={r.mode_label} size="sm" /></td>
                    <td className="td">{r.patient.affected_side}</td>
                    <td className="td"><SeverityBadge value={r.classification} /></td>
                    <td className="td font-bold text-navy tnum">{r.kl_grade}</td>
                    <td className="td">{r.primary_implant}</td>
                    <td className="td font-semibold tnum">{r.confidence_pct}%</td>
                    <td className="td text-right">
                      <Link
                        to={`/results/${r.analysis_id}`}
                        className="inline-flex items-center gap-1 text-accent font-semibold text-[13px]"
                      >
                        Open <Icon name="chevron" size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
