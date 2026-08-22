import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteAnalysis, imageUrl, listAnalyses, getAnalysis, downloadReport } from '../lib/api'
import { Card, Empty, ErrorNote, SeverityBadge, Spinner } from '../components/ui'
import Icon from '../components/Icon'

const FILTERS = ['All', 'Normal', 'Mild OA', 'Moderate OA', 'Severe OA']

export default function History() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [downloadingId, setDownloadingId] = useState(null)

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

  async function handleDownload(id) {
    setDownloadingId(id)
    setError('')
    try {
      const fullResult = await getAnalysis(id)
      await downloadReport(fullResult)
    } catch (e) {
      setError('Failed to download report: ' + e.message)
    } finally {
      setDownloadingId(null)
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
          <h2 className="page-title">History</h2>
          <p className="text-[13px] text-muted mt-1 font-display">{items.length} stored analyses.</p>
        </div>
        <Link to="/new" className="btn-primary"><Icon name="scan" size={15} />New Analysis</Link>
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
          eyebrow="Archive"
          title="Stored Analyses"
          icon="history"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Icon
                  name="search" size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none"
                />
                <input
                  className="input h-8 w-44 pl-8 text-[13px]"
                  placeholder="Search patient"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={[
                      'h-8 px-2.5 rounded-[8px] text-[12px] font-display font-semibold transition-all duration-150',
                      filter === f
                        ? 'text-accent bg-accent-light'
                        : 'text-muted hover:bg-page',
                    ].join(' ')}
                    style={{ border: filter === f ? '2px solid #2D2016' : '2px solid transparent' }}
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
                        className="w-11 h-11 object-cover rounded-[8px] bg-stage"
                        style={{ border: '2px solid #2D2016' }}
                      />
                    </td>
                    <td className="td">
                      <div className="font-display font-semibold text-navy">{r.patient.name}</div>
                      <div className="text-muted text-[11px]">
                        {r.patient.age} · {r.patient.sex} · {r.patient.affected_side}
                      </div>
                    </td>
                    <td className="td text-muted font-display">{r.created_at.replace('T', ' ')}</td>
                    <td className="td"><SeverityBadge value={r.classification} /></td>
                    <td className="td font-display font-bold text-navy tnum">{r.kl_grade}</td>
                    <td className="td tnum font-display">{r.mean_thickness_mm.toFixed(2)} mm</td>
                    <td className="td font-display">
                      {r.primary_implant}
                      <span className="text-muted"> · {r.confidence_pct}%</span>
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          to={`/results/${r.analysis_id}`}
                          className="inline-flex items-center gap-1 h-7 px-2 rounded-[8px] text-accent
                                     font-display font-semibold text-[12px] transition-colors duration-150 hover:bg-accent-light"
                        >
                          Open
                        </Link>
                        <button
                          onClick={() => handleDownload(r.analysis_id)}
                          disabled={downloadingId === r.analysis_id}
                          className="inline-flex items-center gap-1 h-7 px-2 rounded-[8px] text-muted
                                     font-display font-semibold text-[12px] transition-colors duration-150 hover:bg-page hover:text-navy disabled:opacity-50"
                        >
                          <Icon name="download" size={13} /> {downloadingId === r.analysis_id ? 'Wait...' : 'PDF'}
                        </button>
                        <button
                          onClick={() => remove(r.analysis_id)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-[8px] text-ink-300
                                     transition-colors duration-150 hover:bg-danger-light hover:text-danger"
                          aria-label="Delete analysis"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td className="td text-muted font-display" colSpan={8}>No analyses match the current filter.</td>
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
