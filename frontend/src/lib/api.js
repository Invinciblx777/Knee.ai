import { supabase } from './supabase'

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

async function fetchWithAuth(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = { ...options.headers }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  return fetch(url, { ...options, headers })
}

async function handle(res) {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch (_) { /* non-JSON error body */ }
    throw new Error(detail)
  }
  return res.json()
}

export function analyze(file, patient) {
  const form = new FormData()
  form.append('file', file)
  form.append('name', patient.name)
  form.append('age', String(patient.age))
  form.append('sex', patient.sex)
  form.append('imaging_type', patient.imaging_type)
  form.append('affected_side', patient.affected_side)
  return fetchWithAuth(`${BASE}/analyze`, { method: 'POST', body: form }).then(handle)
}

export const listSamples = () => fetchWithAuth(`${BASE}/samples`).then(handle)

export function analyzeSample(source, name) {
  const form = new FormData()
  if (name) form.append('name', name)
  return fetchWithAuth(`${BASE}/analyze/sample/${source}`, { method: 'POST', body: form }).then(handle)
}

export const listAnalyses = async () => {
  const { data, error } = await supabase.from('analyses').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  
  // Map it to the expected compact format for the History page
  const items = data.map(r => ({
    analysis_id: r.analysis_id,
    created_at: r.created_at,
    patient: r.record.patient,
    classification: r.record.meniscus.assessment.classification,
    kl_grade: r.record.meniscus.kl_grade.grade,
    mean_thickness_mm: r.record.meniscus.assessment.mean_thickness_mm,
    primary_implant: `${r.record.implant.primary.system} ${r.record.implant.primary.size} (${r.record.implant.primary.manufacturer})`,
    confidence_pct: r.record.implant.primary.confidence_pct,
    mode: r.record.mode || 'demo',
    mode_label: r.record.mode_label || 'Demo Mode',
    thumbnail: r.record.images.variants['femur-meniscus-tibia'],
    advice: r.advice
  }))
  return { count: items.length, items }
}

export const getAnalysis = async (id) => {
  const { data, error } = await supabase.from('analyses').select('*').eq('analysis_id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Analysis not found')
  // Inject the advice into the record before returning
  const record = data.record
  record.advice = data.advice
  return record
}

export const deleteAnalysis = async (id) => {
  const { error } = await supabase.from('analyses').delete().eq('analysis_id', id)
  if (error) throw new Error(error.message)
  return { deleted: id }
}

export const updateAdvice = async (id, adviceText) => {
  const { error } = await supabase.from('analyses').update({ advice: adviceText }).eq('analysis_id', id)
  if (error) throw new Error(error.message)
  return { success: true }
}

export const getImplants = () => fetchWithAuth(`${BASE}/implants`).then(handle)
export const health = () => fetchWithAuth(`${BASE}/health`).then(handle)

// If the value is already a data URL (base64), return it directly.
// Otherwise construct the API endpoint URL for file-based serving.
export const imageUrl = (filenameOrDataUrl) => {
  if (!filenameOrDataUrl) return ''
  if (filenameOrDataUrl.startsWith('data:')) return filenameOrDataUrl
  return `${BASE}/images/${filenameOrDataUrl}`
}
export async function downloadReport(result) {
  const res = await fetch(`${BASE}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record: result }),
  })
  if (!res.ok) {
    let detail = 'Failed to generate report'
    try {
      const body = await res.json()
      if (body.detail) detail = body.detail
    } catch (_) { /* ignore */ }
    throw new Error(detail)
  }
  
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  
  const contentDisp = res.headers.get('Content-Disposition') || ''
  const match = contentDisp.match(/filename="?([^"]+)"?/)
  a.download = match ? match[1] : `Knee_Report_${result.analysis_id || 'Unknown'}.pdf`
  
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
// Rewrite backend-returned relative sample image paths to the correct absolute URL.
// The backend returns "/api/samples/{source}/image" but in production the frontend
// is on a different domain than the backend, so we must prefix with BASE's origin.
export const sampleImageUrl = (relOrAbs) => {
  if (!relOrAbs) return ''
  if (relOrAbs.startsWith('http')) return relOrAbs
  // relOrAbs is like "/api/samples/OAI_sample_01/image"
  // BASE is like "https://kneeai.vercel.app/api" or "/api" for local dev
  const origin = BASE.startsWith('http') ? new URL(BASE).origin : ''
  return `${origin}${relOrAbs}`
}

/** Key into images.variants for a given overlay toggle state. */
export function variantKey(toggles) {
  const active = ['femur', 'meniscus', 'tibia'].filter((s) => toggles[s]).sort()
  return active.length ? active.join('-') : 'none'
}
