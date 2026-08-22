import { useRef, useState } from 'react'
import { analyseCohort, analyseSampleCohort } from '../lib/api'
import { Card, ErrorNote, Spinner } from '../components/ui'
import Icon from '../components/Icon'
import { CohortScatter, CountBars, GroupMeans, ThicknessHistogram } from '../components/Charts'

/** Descriptive block rendered as a compact stat row. */
function StatRow({ stats, unit = 'mm' }) {
  if (!stats || !stats.n) {
    return <p className="text-[12px] text-muted font-display">No studies in this group.</p>
  }
  const cells = [
    ['n', stats.n, ''],
    ['Mean', stats.mean, unit],
    ['Median', stats.median, unit],
    ['SD', stats.sd, unit],
    ['Min', stats.min, unit],
    ['Max', stats.max, unit],
    ['Q1', stats.q1, unit],
    ['Q3', stats.q3, unit],
  ]
  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
      {cells.map(([k, v, u]) => (
        <div key={k} className="rounded-[10px] bg-page px-2.5 py-2" style={{ border: '2px solid #2D2016' }}>
          <div className="eyebrow text-[9px]">{k}</div>
          <div className="mt-1 text-[15px] font-display font-bold text-navy leading-none tnum">
            {v == null ? '—' : v}
            {v != null && u && <span className="text-[10px] font-semibold text-muted ml-0.5">{u}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Renders a gated comparison: either the effect size, or why it was withheld. */
function Comparison({ comparison }) {
  if (!comparison) return null
  if (!comparison.available) {
    return (
      <div
        className="mt-4 rounded-[10px] bg-page px-3.5 py-3 flex items-start gap-2.5"
        style={{ border: '2px dashed #B0A28E' }}
      >
        <Icon name="alert" size={14} className="text-muted mt-px shrink-0" />
        <div>
          <p className="text-[12px] font-display font-semibold text-navy">Comparison withheld</p>
          <p className="text-[11px] text-muted font-display mt-0.5">{comparison.reason}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="text-[13px] font-display">
        <span className="text-muted">Difference in means </span>
        <span className="text-navy font-bold tnum ml-0.5">
          {comparison.difference_mm > 0 ? '+' : ''}{comparison.difference_mm} mm
        </span>
      </div>
      <div className="text-[13px] font-display">
        <span className="text-muted">Cohen&apos;s d </span>
        <span className="text-navy font-bold tnum ml-0.5">{comparison.cohens_d}</span>
        <span className="text-muted ml-1.5">({comparison.magnitude})</span>
      </div>
    </div>
  )
}

export default function Research() {
  const [files, setFiles] = useState([])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [includeFlagged, setIncludeFlagged] = useState(false)
  const inputRef = useRef(null)

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      setSummary(await fn())
    } catch (e) {
      setError(e.message)
      setSummary(null)
    } finally {
      setBusy(false)
    }
  }

  const s = summary

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="page-title">Research Mode</h2>
        <p className="text-[13px] text-muted mt-1 font-display">
          Batch-analyse studies and summarise measurement distributions across a cohort.
          Descriptive statistics only — no diagnostic claim about any individual study.
        </p>
      </div>

      <Card eyebrow="Cohort Input" title="Batch Analysis" icon="layers" tone="blue">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.bmp,.tif,.tiff,.dcm,.dicom"
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          <button className="btn-ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Icon name="upload" size={15} />
            Select studies
          </button>
          <button
            className="btn-primary"
            disabled={busy || !files.length}
            onClick={() => run(() => analyseCohort(files, {}, includeFlagged))}
          >
            <Icon name="activity" size={15} />
            Analyse {files.length ? `${files.length} studies` : 'cohort'}
          </button>
          <button
            className="btn-dark"
            disabled={busy}
            onClick={() => run(() => analyseSampleCohort(includeFlagged))}
          >
            <Icon name="bone" size={15} />
            Use bundled samples
          </button>

          <label className="flex items-center gap-2 text-[12px] font-display text-muted cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={includeFlagged}
              onChange={(e) => setIncludeFlagged(e.target.checked)}
              className="w-4 h-4 accent-accent"
            />
            Include quality-flagged studies
          </label>
        </div>

        {files.length > 0 && (
          <p className="mt-3 text-[12px] text-muted font-display">
            {files.length} file{files.length === 1 ? '' : 's'} selected. Age defaults to 55 and sex to
            Female where per-study metadata is not supplied.
          </p>
        )}
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}
      {busy && <Spinner label="Analysing cohort…" />}

      {s && !busy && (
        <>
          {/* ── cohort composition ─────────────────────────────────────── */}
          <Card eyebrow="Composition" title="Cohort & Quality Screening" icon="shield" tone="green">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                ['Submitted', s.counts.submitted],
                ['Analysed', s.counts.analysed],
                ['Quality flagged', s.counts.quality_flagged],
                ['Failed', s.counts.failed],
                ['Included in stats', s.counts.included],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[10px] bg-page px-3 py-2.5" style={{ border: '2px solid #2D2016' }}>
                  <div className="eyebrow text-[9px]">{k}</div>
                  <div className="mt-1 text-[20px] font-display font-bold text-navy leading-none tnum">{v}</div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-[12px] text-muted font-display">
              {s.counts.include_flagged
                ? 'Quality-flagged studies are included in these statistics.'
                : 'Studies whose image quality triggered clinical review are excluded from the statistics below.'}
            </p>

            {s.excluded?.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {s.excluded.map((x) => (
                  <div key={x.label} className="flex items-center gap-2 text-[11px] font-display text-muted">
                    <Icon name="alert" size={12} className="text-warn shrink-0" />
                    <span className="text-navy font-semibold">{x.label}</span>
                    <span>— quality {x.quality_score_pct}% ({x.quality_level}), excluded</span>
                  </div>
                ))}
              </div>
            )}

            {s.failures?.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {s.failures.map((f) => (
                  <div key={f.label} className="flex items-center gap-2 text-[11px] font-display text-danger">
                    <Icon name="alert" size={12} className="shrink-0" />
                    <span className="font-semibold">{f.label}</span><span>— {f.reason}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5">
              <p className="eyebrow mb-2">Image quality across included studies</p>
              <StatRow stats={s.quality} unit="%" />
            </div>
          </Card>

          {/* ── thickness distribution ─────────────────────────────────── */}
          <Card eyebrow="Module 1" title="Medial Meniscus Thickness Distribution" icon="ruler" tone="green">
            <StatRow stats={s.thickness.overall} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="rounded-[12px] p-4" style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}>
                <p className="eyebrow mb-4">Distribution of mean thickness</p>
                <ThicknessHistogram bins={s.thickness.histogram} />
              </div>
              <div className="rounded-[12px] p-4" style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}>
                <p className="eyebrow mb-4">Age vs thickness, by OA class</p>
                <CohortScatter points={s.scatter} />
              </div>
            </div>

            <div className="mt-6">
              <p className="eyebrow mb-3">By anatomical location</p>
              <div className="space-y-3">
                {Object.entries(s.thickness.by_location).map(([k, stats]) => (
                  <div key={k}>
                    <p className="text-[12px] font-display font-semibold text-navy mb-1.5 capitalize">
                      {k.replace(/_/g, ' ')}
                    </p>
                    <StatRow stats={stats} />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* ── OA status ──────────────────────────────────────────────── */}
          <Card eyebrow="Association" title="Thickness by OA Status" icon="activity" tone="amber">
            <div
              className="mb-5 rounded-[10px] bg-warn-light px-3.5 py-3 flex items-start gap-2.5"
              style={{ border: '2px solid #2D2016' }}
            >
              <Icon name="alert" size={14} className="text-warn mt-px shrink-0" />
              <div>
                <p className="text-[12px] font-display font-bold text-navy">Definitional, not empirical</p>
                <p className="text-[11px] text-muted font-display mt-0.5 leading-relaxed">{s.oa.note}</p>
              </div>
            </div>
            <GroupMeans groups={s.oa.by_class} />
            <div className="mt-5 space-y-3">
              {s.oa.by_class.filter((g) => g.n > 0).map((g) => (
                <div key={g.label}>
                  <p className="text-[12px] font-display font-semibold text-navy mb-1.5">{g.label}</p>
                  <StatRow stats={g} />
                </div>
              ))}
            </div>
            <Comparison comparison={s.oa.comparison} />
          </Card>

          {/* ── sex & age ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card eyebrow="Association" title="Thickness by Sex" icon="user" tone="blue">
              <GroupMeans groups={s.sex.groups} />
              <div className="mt-5 space-y-3">
                {s.sex.groups.map((g) => (
                  <div key={g.label}>
                    <p className="text-[12px] font-display font-semibold text-navy mb-1.5">
                      {g.label} (n={g.n})
                    </p>
                    <StatRow stats={g} />
                  </div>
                ))}
              </div>
              <Comparison comparison={s.sex.comparison} />
            </Card>

            <Card eyebrow="Association" title="Thickness by Age Band" icon="history" tone="amber">
              <GroupMeans groups={s.age.groups} />
              <div className="mt-5 space-y-3">
                {s.age.groups.filter((g) => g.n > 0).map((g) => (
                  <div key={g.label}>
                    <p className="text-[12px] font-display font-semibold text-navy mb-1.5">
                      Age {g.label} (n={g.n})
                    </p>
                    <StatRow stats={g} />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ── correlations ───────────────────────────────────────────── */}
          <Card eyebrow="Association" title="Correlations" icon="layers" tone="slate">
            <div className="space-y-3">
              {s.correlations.map((c) => (
                <div
                  key={c.label}
                  className="rounded-[10px] bg-page px-3.5 py-3"
                  style={{ border: '2px solid #2D2016' }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[13px] font-display font-semibold text-navy">{c.label}</span>
                    {c.available ? (
                      <span className="text-[13px] font-display">
                        <span className="text-muted">r = </span>
                        <span className="text-navy font-bold tnum">{c.r}</span>
                        <span className="text-muted ml-1.5">({c.strength}, {c.direction}, n={c.n})</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-display text-muted">{c.reason}</span>
                    )}
                  </div>
                  {c.caveat && (
                    <p className="mt-1.5 text-[11px] text-muted font-display leading-relaxed">{c.caveat}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* ── implant summary ────────────────────────────────────────── */}
          {s.implant?.available && (
            <Card eyebrow="Module 2" title="Implant Sizing Summary" icon="implant" tone="blue">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-[12px] p-4" style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}>
                  <p className="eyebrow mb-4">Recommended size distribution</p>
                  <CountBars items={s.implant.size_distribution} />
                </div>
                <div className="rounded-[12px] p-4" style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}>
                  <p className="eyebrow mb-4">Implant system distribution</p>
                  <CountBars items={s.implant.system_distribution} color="#2D9F6F" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="eyebrow mb-2">Match confidence</p>
                  <StatRow stats={s.implant.match_confidence_pct} unit="%" />
                </div>
                <div>
                  <p className="eyebrow mb-2">Largest single-dimension deviation</p>
                  <StatRow stats={s.implant.max_deviation_mm} />
                </div>
                {Object.entries(s.implant.bone_dimensions_mm).map(([k, stats]) => (
                  <div key={k}>
                    <p className="eyebrow mb-2">{k.replace(/_/g, ' ')}</p>
                    <StatRow stats={stats} />
                  </div>
                ))}
              </div>

              <p className="mt-5 text-[11px] text-muted font-display leading-relaxed">{s.implant.note}</p>
            </Card>
          )}

          <div className="flex items-start gap-2.5 pt-6" style={{ borderTop: '1px solid #E8DCC8' }}>
            <Icon name="shield" size={15} className="text-ink-300 mt-px shrink-0" />
            <p className="text-[12px] text-muted leading-relaxed font-display">{s.interpretation}</p>
          </div>
        </>
      )}
    </div>
  )
}
