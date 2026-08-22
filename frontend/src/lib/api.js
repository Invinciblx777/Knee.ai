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

export const listAnalyses = () => fetchWithAuth(`${BASE}/analyses`).then(handle)
export const getAnalysis = (id) => fetchWithAuth(`${BASE}/analyses/${id}`).then(handle)
export const deleteAnalysis = (id) =>
  fetchWithAuth(`${BASE}/analyses/${id}`, { method: 'DELETE' }).then(handle)
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
