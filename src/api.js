const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5173'

export async function getSchools() {
  const r = await fetch(`${API_BASE}/api/schools`)
  if (!r.ok) throw new Error(`GET /api/schools failed: ${r.status}`)
  const j = await r.json()
  return j.data || []
}

export async function createSchool(payload) {
  const r = await fetch(`${API_BASE}/api/schools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`POST /api/schools failed: ${r.status} ${t}`)
  }
  return r.json()
}

export async function uploadExcel(file) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${API_BASE}/api/upload-schools`, {
    method: 'POST',
    body: fd
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`POST /api/upload-schools failed: ${r.status} ${t}`)
  }
  return r.json()
}
