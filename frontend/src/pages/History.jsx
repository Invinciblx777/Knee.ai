import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteAnalysis, imageUrl, listAnalyses, reportUrl } from '../lib/api'
import { Card, Empty, ErrorNote, ModeBadge, SeverityBadge, Spinner } from '../components/ui'

const FILTERS = ['All', 'Normal', 'Mild OA', 'Moderate OA', 'Severe OA']

export default function History() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')

  const load = () => listAnalyses().then((d) => setItems(d.items)).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  async function remove(id) {
    setError('')
    try {
      await deleteAnalysis(id)
      setItems((list) => list.filter((i) => i.analysis_id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  if (error && !items) return <ErrorNote>{error}</ErrorNote>
  if (!items) return <Spinner label="Loading history…" />

  const visible = items.filter((i) => {
    const passFilter = filter === 'All' || i.classification === filter
    const passQuery = i.patient.name.toLowerCase().includes(query.trim().toLowerCase())
    return passFilter && passQuery
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold text-navy">History</h2>
          <p className="text-[13px] text-muted mt-1">{items.length} stored analyses.</p>
        </div>
        <Link to="/new" className="btn-primary">New Analysis</Link>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {items.length === 0 ? (
        <Empty
          title="Nothing stored yet"
          body="Completed analyses appear here with their assessment, implant recommendation and report."
          cta={{ to: '/new', label: 'Run an analysis' }}
        />
      ) : (
        <Card
          title="Stored Analyses"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input h-8 w-40 text-[13px]"
                placeholder="Search patient"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="flex gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={[
                      'h-8 px-2.5 rounded-card border text-[12px] font-medium transition-colors',
                      filter === f ? 'border-accent text-accent bg-accent/5' : 'border-line text-muted hover:bg-surface',
                    ].join(' ')}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Scan</th>
                  <th className="th">Patient</th>
                  <th className="th">Date</th>
                  <th className="th">Mode</th>
                  <th className="th">Assessment</th>
                  <th className="th">KL</th>
                  <th className="th">Mean thickness</th>
                  <th className="th">Primary implant</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.analysis_id} className="row-hover">
                    <td className="td">
                      <img
                        src={imageUrl(r.thumbnail)}
                        alt=""
                        className="w-10 h-10 object-cover rounded border border-line"
                      />
                    </td>
                    <td className="td">
                      <div className="font-medium">{r.patient.name}</div>
                      <div className="text-muted text-[12px]">
                        {r.patient.age} · {r.patient.sex} · {r.patient.affected_side}
                      </div>
                    </td>
                    <td className="td text-muted">{r.created_at.replace('T', ' ')}</td>
                    <td className="td"><ModeBadge mode={r.mode} label={r.mode_label} size="sm" /></td>
                    <td className="td"><SeverityBadge value={r.classification} /></td>
                    <td className="td font-semibold">{r.kl_grade}</td>
                    <td className="td">{r.mean_thickness_mm.toFixed(2)} mm</td>
                    <td className="td">
                      {r.primary_implant}
                      <span className="text-muted"> · {r.confidence_pct}%</span>
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      <Link to={`/results/${r.analysis_id}`} className="text-accent font-medium text-[13px]">Open</Link>
                      <a
                        href={reportUrl(r.analysis_id)} target="_blank" rel="noreferrer"
                        className="text-accent font-medium text-[13px] ml-3"
                      >
                        PDF
                      </a>
                      <button onClick={() => remove(r.analysis_id)} className="text-danger font-medium text-[13px] ml-3">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td className="td text-muted" colSpan={9}>No analyses match the current filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
