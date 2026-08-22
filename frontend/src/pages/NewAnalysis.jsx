import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyze, analyzeSample, listSamples, sampleImageUrl } from '../lib/api'
import { useLanguage } from '../lib/LanguageContext'
import { Card, Disclaimer, ErrorNote, Spinner } from '../components/ui'
import Icon, { IconChip } from '../components/Icon'

const ACCEPT = '.jpg,.jpeg,.png,.bmp,.tif,.tiff,.dcm,.dicom'

const EMPTY = {
  name: '',
  age: '',
  sex: 'Female',
  imaging_type: 'X-ray',
  affected_side: 'Left',
}

export default function NewAnalysis() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const inputRef = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [samples, setSamples] = useState(null)
  const [runningSample, setRunningSample] = useState('')

  useEffect(() => {
    listSamples().then((d) => setSamples(d.items)).catch(() => setSamples([]))
  }, [])

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function pick(next) {
    setError('')
    if (!next) return
    const ok = ACCEPT.split(',').some((ext) => next.name.toLowerCase().endsWith(ext))
    if (!ok) {
      setError(`${t('unsupportedFileType')} ${ACCEPT}`)
      return
    }
    setFile(next)
  }

  const ready = file && form.name.trim() && form.age !== '' && Number(form.age) > 0

  async function run() {
    setError('')
    setBusy(true)
    try {
      const result = await analyze(file, { ...form, age: Number(form.age) })
      navigate(`/results/${result.analysis_id}`, { state: { result } })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function runSample(source) {
    setError('')
    setRunningSample(source)
    try {
      const result = await analyzeSample(source, form.name.trim())
      navigate(`/results/${result.analysis_id}`, { state: { result } })
    } catch (e) {
      setError(e.message)
    } finally {
      setRunningSample('')
    }
  }

  const isDicom = file && /\.(dcm|dicom)$/i.test(file.name)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">{t('newAnalysisTitle')}</h2>
        <p className="text-[13px] text-muted mt-1.5 font-display">{t('newAnalysisSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card eyebrow={t('stepImaging')} title={t('imaging')} icon="scan" tone="blue">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              pick(e.dataTransfer.files?.[0])
            }}
            onClick={() => inputRef.current?.click()}
            className={[
              'rounded-[12px] px-4 py-12 text-center cursor-pointer',
              'transition-all duration-200',
              dragging
                ? 'bg-accent-light scale-[1.01]'
                : 'bg-page hover:bg-accent-light/50',
            ].join(' ')}
            style={{
              border: dragging ? '3px dashed #E8772E' : '3px dashed #D5C9B5',
            }}
          >
            <span
              className={[
                'mx-auto w-12 h-12 rounded-[10px] flex items-center justify-center transition-colors duration-200',
                dragging ? 'bg-accent text-white' : 'bg-accent-light text-accent',
              ].join(' ')}
              style={{ border: '2px solid #2D2016' }}
            >
              <Icon name="upload" size={22} />
            </span>
            <p className="mt-4 text-[14px] font-display font-semibold text-navy">
              {file ? file.name : t('dropImagePrompt')}
            </p>
            <p className="text-[12px] text-muted mt-1.5 font-display">{t('uploadPrompt')}</p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>

          {file && (
            <div className="mt-4">
              <div className="stage flex items-center justify-center min-h-[220px]">
                {preview && !isDicom ? (
                  <img src={preview} alt="Upload preview" className="max-h-[340px] w-auto" />
                ) : (
                  <div className="text-center px-6 py-10">
                    <p className="text-[13px] font-display font-semibold text-navy/60">{t('previewUnavailable')}</p>
                    <p className="text-[12px] text-muted mt-1">{t('dicomPreviewNote')}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-3 text-[12px] text-muted font-display">
                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                <button className="text-accent font-semibold" onClick={(e) => { e.stopPropagation(); setFile(null) }}>
                  {t('remove')}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 pt-5" style={{ borderTop: '2px solid #2D2016' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <IconChip name="sparkle" tone="green" size="sm" />
                <div>
                  <h3 className="text-[13px] font-display font-semibold text-navy">{t('preAnalyzedSamples')}</h3>
                  <p className="text-[11px] text-muted font-display">{t('oneClickSamples')}</p>
                </div>
              </div>
              <span className="pill-pos">{t('aiReady')}</span>
            </div>

            {samples === null ? (
              <div className="mt-4"><Spinner label={t('loadingSamples')} /></div>
            ) : samples.length === 0 ? (
              <p className="mt-3 text-[12px] text-muted font-display">{t('noSamplesInstalled')}</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {samples.map((s) => (
                  <button
                    key={s.source}
                    onClick={() => runSample(s.source)}
                    disabled={!!runningSample}
                    title={s.note}
                    className="group text-left rounded-[12px] overflow-hidden bg-surface
                               transition-all duration-200 hover:-translate-y-1
                               disabled:opacity-60 disabled:cursor-not-allowed
                               disabled:hover:translate-y-0"
                    style={{
                      border: '2px solid #2D2016',
                      boxShadow: '3px 3px 0 #2D2016',
                    }}
                  >
                    <div className="relative aspect-[3/4] bg-stage overflow-hidden">
                      <img
                        src={sampleImageUrl(s.image_url)} alt={s.source}
                        className="w-full h-full object-cover transition-transform duration-300
                                   group-hover:scale-[1.06]"
                      />
                      <span
                        className="absolute top-2 right-2 rounded-[6px] bg-navy text-white text-[10px] font-display font-bold px-1.5 py-0.5"
                      >
                        KL{s.kl_grade}
                      </span>
                      <span className="absolute inset-x-0 bottom-0 h-9 flex items-center justify-center
                                       bg-accent text-white text-[11px] font-display font-semibold translate-y-full
                                       transition-transform duration-200 group-hover:translate-y-0">
                        {runningSample === s.source ? t('runningEllipsis') : t('runAnalysisShort')}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <div className="text-[11px] font-display font-semibold text-navy">
                        {s.patient.age} · {s.patient.sex.charAt(0)} · {s.patient.side.charAt(0)}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: ['#2D9F6F', '#E8772E', '#D4A017', '#E85D75', '#E85D75'][s.kl_grade],
                          }}
                        />
                        <span className="text-[10px] text-muted truncate font-display">{s.oa_classification}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card eyebrow={t('stepIntake')} title={t('patientIntake')} icon="user" tone="slate">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="name">{t('patientName')}</label>
              <input id="name" className="input" value={form.name} onChange={set('name')} placeholder="e.g. Jane Doe" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="age">{t('age')}</label>
                <input
                  id="age" type="number" min="1" max="120" className="input"
                  value={form.age} onChange={set('age')} placeholder="e.g. 64"
                />
              </div>
              <div>
                <label className="label" htmlFor="sex">{t('sex')}</label>
                {/* value stays the English literal the backend expects ("Female"/"Male");
                    only the visible label is translated. */}
                <select id="sex" className="input" value={form.sex} onChange={set('sex')}>
                  <option value="Female">{t('female')}</option>
                  <option value="Male">{t('male')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="imaging">{t('imagingType')}</label>
                {/* X-ray / MRI are imaging-modality terms used as-is across languages,
                    left untranslated deliberately. */}
                <select id="imaging" className="input" value={form.imaging_type} onChange={set('imaging_type')}>
                  <option>X-ray</option>
                  <option>MRI</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="side">{t('affectedSide')}</label>
                <select id="side" className="input" value={form.affected_side} onChange={set('affected_side')}>
                  <option value="Left">{t('left')}</option>
                  <option value="Right">{t('right')}</option>
                </select>
              </div>
            </div>

            <ErrorNote>{error}</ErrorNote>

            <div className="flex items-center gap-3 pt-1">
              <button className="btn-primary" disabled={!ready || busy} onClick={run}>
                {busy
                  ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  : <Icon name="sparkle" size={15} />}
                {busy ? t('runningAnalysis') : t('runAnalysis')}
              </button>
              {!ready && (
                <span className="text-[12px] text-muted font-display">{t('readyHint')}</span>
              )}
            </div>

            <Disclaimer />
          </div>
        </Card>
      </div>
    </div>
  )
}
