import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyze, analyzeSample, listSamples, sampleImageUrl } from '../lib/api'
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
      setError(`Unsupported file type. Accepted: ${ACCEPT}`)
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
        <h2 className="page-title">New Analysis</h2>
        <p className="text-[13px] text-muted mt-1.5">
          Upload a knee X-ray or MRI and complete the patient intake to run both assessment modules.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card eyebrow="Step 01" title="Imaging" icon="scan" tone="blue">
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
              'rounded-card border-2 border-dashed px-4 py-12 text-center cursor-pointer',
              'transition-all duration-200',
              dragging
                ? 'border-accent bg-accent-light scale-[1.01]'
                : 'border-line hover:border-accent/50 hover:bg-page/70',
            ].join(' ')}
          >
            <span className={[
              'mx-auto w-12 h-12 rounded-xl2 flex items-center justify-center transition-colors duration-200',
              dragging ? 'bg-accent text-white' : 'bg-accent-light text-accent',
            ].join(' ')}>
              <Icon name="upload" size={22} />
            </span>
            <p className="mt-4 text-[14px] font-semibold text-navy">
              {file ? file.name : 'Drop an image here, or click to browse'}
            </p>
            <p className="text-[12px] text-muted mt-1.5">
              JPEG, PNG, BMP, TIFF or DICOM-lite · up to 25 MB
            </p>
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
                    <p className="text-[13px] font-semibold text-white/80">Preview unavailable</p>
                    <p className="text-[12px] text-white/45 mt-1">
                      DICOM-lite files render after the server decodes them.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-3 text-[12px] text-muted">
                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                <button className="text-accent font-medium" onClick={(e) => { e.stopPropagation(); setFile(null) }}>
                  Remove
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-line">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <IconChip name="sparkle" tone="green" size="sm" />
                <div>
                  <h3 className="text-[13px] font-semibold text-navy">Pre-analyzed samples</h3>
                  <p className="text-[11px] text-muted">One click runs the stored model output</p>
                </div>
              </div>
              <span className="pill-pos">Model Inference</span>
            </div>

            {samples === null ? (
              <div className="mt-4"><Spinner label="Loading samples…" /></div>
            ) : samples.length === 0 ? (
              <p className="mt-3 text-[12px] text-muted">No sample dataset installed.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {samples.map((s) => (
                  <button
                    key={s.source}
                    onClick={() => runSample(s.source)}
                    disabled={!!runningSample}
                    title={s.note}
                    className="group text-left rounded-card border border-line overflow-hidden bg-surface
                               transition-all duration-200 hover:border-accent hover:shadow-lift
                               hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed
                               disabled:hover:translate-y-0 disabled:hover:shadow-card"
                  >
                    <div className="relative aspect-[3/4] bg-stage overflow-hidden">
                      <img
                        src={sampleImageUrl(s.image_url)} alt={s.source}
                        className="w-full h-full object-cover transition-transform duration-300
                                   group-hover:scale-[1.06]"
                      />
                      <span className="absolute top-2 right-2 rounded-md bg-black/60 backdrop-blur-sm
                                       text-white text-[10px] font-bold px-1.5 py-0.5">
                        KL{s.kl_grade}
                      </span>
                      <span className="absolute inset-x-0 bottom-0 h-9 flex items-center justify-center
                                       bg-accent text-white text-[11px] font-semibold translate-y-full
                                       transition-transform duration-200 group-hover:translate-y-0">
                        {runningSample === s.source ? 'Running…' : 'Run analysis'}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <div className="text-[11px] font-semibold text-navy">
                        {s.patient.age} · {s.patient.sex.charAt(0)} · {s.patient.side.charAt(0)}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#F97316', '#EF4444'][s.kl_grade],
                          }}
                        />
                        <span className="text-[10px] text-muted truncate">{s.oa_classification}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card eyebrow="Step 02" title="Patient Intake" icon="user" tone="slate">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="name">Patient name</label>
              <input id="name" className="input" value={form.name} onChange={set('name')} placeholder="e.g. Jane Doe" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="age">Age</label>
                <input
                  id="age" type="number" min="1" max="120" className="input"
                  value={form.age} onChange={set('age')} placeholder="e.g. 64"
                />
              </div>
              <div>
                <label className="label" htmlFor="sex">Sex</label>
                <select id="sex" className="input" value={form.sex} onChange={set('sex')}>
                  <option>Female</option>
                  <option>Male</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="imaging">Imaging type</label>
                <select id="imaging" className="input" value={form.imaging_type} onChange={set('imaging_type')}>
                  <option>X-ray</option>
                  <option>MRI</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="side">Affected side</label>
                <select id="side" className="input" value={form.affected_side} onChange={set('affected_side')}>
                  <option>Left</option>
                  <option>Right</option>
                </select>
              </div>
            </div>

            <ErrorNote>{error}</ErrorNote>

            <div className="flex items-center gap-3 pt-1">
              <button className="btn-primary" disabled={!ready || busy} onClick={run}>
                {busy
                  ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  : <Icon name="sparkle" size={15} />}
                {busy ? 'Running analysis…' : 'Run Analysis'}
              </button>
              {!ready && (
                <span className="text-[12px] text-muted">
                  Upload an image and fill in name and age to continue.
                </span>
              )}
            </div>

            <Disclaimer />
          </div>
        </Card>
      </div>
    </div>
  )
}
