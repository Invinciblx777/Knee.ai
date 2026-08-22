const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

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
  return fetch(`${BASE}/analyze`, { method: 'POST', body: form }).then(handle)
}

export const listSamples = () => fetch(`${BASE}/samples`).then(handle)

export function analyzeSample(source, name) {
  const form = new FormData()
  if (name) form.append('name', name)
  return fetch(`${BASE}/analyze/sample/${source}`, { method: 'POST', body: form }).then(handle)
}

export const listAnalyses = () => fetch(`${BASE}/analyses`).then(handle)
export const getAnalysis = (id) => fetch(`${BASE}/analyses/${id}`).then(handle)
export const deleteAnalysis = (id) =>
  fetch(`${BASE}/analyses/${id}`, { method: 'DELETE' }).then(handle)
export const getImplants = () => fetch(`${BASE}/implants`).then(handle)
export const health = () => fetch(`${BASE}/health`).then(handle)

export const imageUrl = (filename) => `${BASE}/images/${filename}`
export const reportUrl = (id) => `${BASE}/report/${id}`

/** Key into images.variants for a given overlay toggle state. */
export function variantKey(toggles) {
  const active = ['femur', 'meniscus', 'tibia'].filter((s) => toggles[s]).sort()
  return active.length ? active.join('-') : 'none'
}
