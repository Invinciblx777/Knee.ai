import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useParams } from 'react-router-dom'
import { getAnalysis, downloadReport, getFoodAdvice, getVisionObservations, listAnalyses } from '../lib/api'
import { useLanguage } from '../lib/LanguageContext'
import { LANGUAGE_NAMES } from '../lib/i18n'
import { Card, CompareBar, ErrorNote, SeverityBadge, Spinner } from './ui'
import Icon, { IconChip } from './Icon'

const KL_COLOR = ['#2D9F6F', '#E8772E', '#D4A017', '#E85D75', '#E85D75']

const QUALITY_TONE = { good: 'bg-ok', fair: 'bg-warn', low: 'bg-danger' }

/** Banner shown when the film is too degraded to trust the automated numbers. */
function ReviewBanner({ quality }) {
  const { t } = useLanguage()
  const weak = quality.factors.filter((f) => f.status === 'low')
  return (
    <div
      className="rounded-[12px] bg-warn-light px-4 py-3.5 flex items-start gap-3"
      style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}
    >
      <Icon name="alert" size={17} className="text-warn mt-px shrink-0" />
      <div>
        <p className="text-[13px] font-display font-bold text-navy">{t('reviewRecommended')}</p>
        <p className="mt-1 text-[12px] text-muted font-display leading-relaxed">
          Image quality scored {quality.score_pct}% ({quality.level_label.toLowerCase()})
          {weak.length > 0 && <> — limiting {weak.map((f) => f.name.toLowerCase()).join(' and ')}</>}.
          Verify each measurement against the overlay before acting on it.
        </p>
      </div>
    </div>
  )
}

/** Per-factor image quality breakdown plus the tolerance bands it implies. */
function QualityCard({ quality, uncertainty }) {
  const { t } = useLanguage()
  return (
    <Card
      eyebrow={t('measurementConfidence')}
      title={t('imageQualityUncertainty')}
      icon="shield"
      tone={quality.level === 'good' ? 'green' : quality.level === 'acceptable' ? 'amber' : 'red'}
      action={
        <span
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1
                     text-[12px] font-display font-semibold bg-surface text-navy"
          style={{ border: '2px solid #2D2016' }}
        >
          <span className={`w-2 h-2 rounded-full ${QUALITY_TONE[_statusOf(quality.level)]}`} />
          {quality.score_pct}% · {quality.level_label}
        </span>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {quality.factors.map((f) => (
          <div
            key={f.name}
            className="rounded-[10px] bg-page px-3 py-2.5"
            style={{ border: '2px solid #2D2016' }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow text-[9px]">{f.name}</span>
              <span className="text-[11px] font-display font-bold text-navy tnum">{f.score_pct}%</span>
            </div>
            <div
              className="mt-2 h-1.5 rounded-full bg-ink-100 overflow-hidden"
              style={{ border: '1px solid #2D2016' }}
            >
              <div
                className={`h-full rounded-full ${QUALITY_TONE[f.status]}`}
                style={{ width: `${f.score_pct}%` }}
              />
            </div>
            <div className="mt-2 text-[10px] text-muted font-display leading-tight">{f.detail}</div>
          </div>
        ))}
      </div>

      {uncertainty && (
        <>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            {[
              [t('uncertaintyMeniscus'), `±${uncertainty.meniscus_mm} mm`],
              [t('uncertaintyBone'), `±${uncertainty.bone_mm} mm`],
              [t('tibialSlope'), `±${uncertainty.slope_deg}°`],
            ].map(([k, v]) => (
              <div key={k} className="text-[13px] font-display">
                <span className="text-muted">{k} </span>
                <span className="text-navy font-bold tnum ml-0.5">{v}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted font-display">{uncertainty.basis}</p>
        </>
      )}
    </Card>
  )
}

function _statusOf(level) {
  return level === 'good' ? 'good' : level === 'acceptable' ? 'fair' : 'low'
}

/** Big labelled divider so the two clinical modules read as separate sections. */
function ModuleHeader({ n, title, subtitle, tone }) {
  const { t } = useLanguage()
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${tone} text-white
                      text-[12px] font-display font-bold uppercase tracking-wider`}
          style={{ border: '2px solid #2D2016', boxShadow: '3px 3px 0 #2D2016' }}
        >
          {t('moduleWord')} {n}
        </span>
        <h2 className="text-[21px] font-display font-bold text-navy tracking-[-0.02em] leading-tight">
          {title}
        </h2>
      </div>
      <p className="mt-1.5 text-[13px] text-muted font-display">{subtitle}</p>
      <div className="mt-4" style={{ borderTop: '2px solid #2D2016' }} />
    </div>
  )
}

function PatientHeader({ result, onGetAdvice, gettingAdvice, onGetVision, gettingVision }) {
  const { t } = useLanguage()
  const p = result.patient
  const fields = [
    [t('age'), p.age],
    [t('sex'), p.sex === 'Female' ? t('female') : t('male')],
    [t('imaging'), p.imaging_type],
    [t('sideShort'), `${p.affected_side === 'Left' ? t('left') : t('right')} ${t('kneeSuffix')}`],
    [t('analysedLabel'), result.created_at.replace('T', ' ')],
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

        <div className="flex items-center gap-2.5 flex-wrap">
          <button className="btn-ghost" onClick={onGetVision} disabled={gettingVision}>
            <Icon name="search" size={15} />
            {gettingVision ? t('scanningImage') : t('getAiVisualScan')}
          </button>
          <button className="btn-ghost" onClick={onGetAdvice} disabled={gettingAdvice}>
            <Icon name="leaf" size={15} />
            {gettingAdvice ? t('thinking') : t('getAiFoodDiet')}
          </button>
          <button className="btn-dark" onClick={handleDownload} disabled={downloading}>
            <Icon name="download" size={15} />
            {downloading ? t('generatingReport') : t('generateReport')}
          </button>
        </div>
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
  const { t } = useLanguage()
  const isFemale = sex === 'Female'
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="th">{t('colLocation')}</th>
            <th className="th">{t('tablePatient')}</th>
            <th className="th">{t('colVsPopulation')}</th>
            <th className="th">{t('colMaleMean')}</th>
            <th className="th">{t('colFemaleMean')}</th>
            <th className="th">{t('colDeviation')}</th>
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
  const { t } = useLanguage()
  const rows = [
    { rank: t('rankPrimary'), ...implant.primary },
    ...implant.alternatives.map((a, i) => ({ rank: `${t('rankAlternative')} ${i + 1}`, ...a })),
  ]
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="th">{t('colRank')}</th>
            <th className="th">{t('colManufacturerSystem')}</th>
            <th className="th">{t('colSize')}</th>
            <th className="th">{t('colFemoralMlAp')}</th>
            <th className="th">{t('colTibialMlAp')}</th>
            <th className="th">{t('colDeltaMax')}</th>
            <th className="th">{t('tableMatch')}</th>
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
/** Tabs between the two clinical modules for the same study. */
function ModuleTabs({ id }) {
  const { t } = useLanguage()
  const tabs = [
    { to: `/oa/${id}`, label: t('tabMeniscusOa'), icon: 'ruler' },
    { to: `/implant/${id}`, label: t('tabImplant'), icon: 'implant' },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            [
              'inline-flex items-center gap-2 h-10 px-4 rounded-[10px] whitespace-nowrap',
              'text-[13px] font-display font-semibold transition-all duration-150',
              isActive ? 'bg-accent text-white' : 'bg-surface text-navy hover:bg-page',
            ].join(' ')
          }
          style={({ isActive }) => ({
            border: '2px solid #2D2016',
            boxShadow: isActive ? '3px 3px 0 #2D2016' : '2px 2px 0 #2D2016',
          })}
        >
          <Icon name={tab.icon} size={15} />
          {tab.label}
        </NavLink>
      ))}
    </div>
  )
}

/**
 * Everything the two module pages share: resolving which study to show, the
 * patient header, quality banner, clinician/AI notes, and the tab switcher.
 *
 * Rendered with no :id (the sidebar entries), it falls back to the most recent
 * analysis so the nav links always land somewhere useful.
 */
export function AnalysisShell({ children }) {
  const { id } = useParams()
  const { state } = useLocation()
  const { t, language } = useLanguage()
  const [result, setResult] = useState(state?.result ?? null)
  const [error, setError] = useState('')
  const [empty, setEmpty] = useState(false)
  const [foodAdvice, setFoodAdvice] = useState('')
  const [adviceError, setAdviceError] = useState('')
  const [gettingAdvice, setGettingAdvice] = useState(false)
  const [visionResult, setVisionResult] = useState('')
  const [visionError, setVisionError] = useState('')
  const [gettingVision, setGettingVision] = useState(false)

  const handleGetAdvice = async () => {
    setGettingAdvice(true)
    setAdviceError('')
    try {
      const { advice } = await getFoodAdvice(result, LANGUAGE_NAMES[language])
      setFoodAdvice(advice)
    } catch (e) {
      setAdviceError(e.message)
    } finally {
      setGettingAdvice(false)
    }
  }

  const handleGetVision = async () => {
    setGettingVision(true)
    setVisionError('')
    try {
      const filename = result.images?.variants?.none
      const { observations } = await getVisionObservations(filename, result, LANGUAGE_NAMES[language])
      setVisionResult(observations)
    } catch (e) {
      setVisionError(e.message)
    } finally {
      setGettingVision(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setError('')
    setEmpty(false)

    if (id) {
      if (result && result.analysis_id === id) return
      getAnalysis(id)
        .then((r) => !cancelled && setResult(r))
        .catch((e) => !cancelled && setError(e.message))
    } else {
      // Sidebar entry with no study chosen — show the most recent one.
      listAnalyses()
        .then(({ items }) => {
          if (cancelled) return
          if (!items.length) return setEmpty(true)
          return getAnalysis(items[0].analysis_id).then((r) => !cancelled && setResult(r))
        })
        .catch((e) => !cancelled && setError(e.message))
    }
    return () => { cancelled = true }
  }, [id])

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <Link to="/new" className="btn-primary">{t('startNewAnalysis')}</Link>
      </div>
    )
  }

  if (empty) {
    return (
      <div className="space-y-4">
        <Card eyebrow={t('noStudiesYet')} title={t('nothingToShow')} icon="scan" tone="slate">
          <p className="text-[13px] text-muted font-display">{t('runAnalysisEmptyBody')}</p>
          <Link to="/new" className="btn-primary mt-4">{t('startNewAnalysis')}</Link>
        </Card>
      </div>
    )
  }

  if (!result) return <Spinner label={t('loadingAnalysis')} />

  return (
    <div className="space-y-8 animate-fade-up">
      <PatientHeader
        result={result}
        onGetAdvice={handleGetAdvice} gettingAdvice={gettingAdvice}
        onGetVision={handleGetVision} gettingVision={gettingVision}
      />

      {result.quality?.review_recommended && <ReviewBanner quality={result.quality} />}

      <ModuleTabs id={result.analysis_id} />

      {result.advice && (
        <Card eyebrow="Clinician Note" title={t('clinicianNote')} icon="file" tone="green">
          <p className="text-[13px] text-navy font-display leading-relaxed whitespace-pre-wrap">{result.advice}</p>
        </Card>
      )}

      {(visionResult || visionError) && (
        <Card eyebrow={t('aiGenerated')} title={t('aiVisualObservationsTitle')} icon="search" tone="blue">
          {visionError ? (
            <ErrorNote>{visionError}</ErrorNote>
          ) : (
            <p className="text-[13px] text-navy font-display leading-relaxed whitespace-pre-wrap">{visionResult}</p>
          )}
        </Card>
      )}

      {(foodAdvice || adviceError) && (
        <Card eyebrow={t('aiGenerated')} title={t('foodDietAdvice')} icon="leaf" tone="green">
          {adviceError ? (
            <ErrorNote>{adviceError}</ErrorNote>
          ) : (
            <p className="text-[13px] text-navy font-display leading-relaxed whitespace-pre-wrap">{foodAdvice}</p>
          )}
        </Card>
      )}

      {children(result)}
    </div>
  )
}

export { KL_COLOR, ModuleHeader, QualityCard, MeniscusTable, ImplantTable }
