// Dynamic API base URL management for deployment modes (local / connect / host)
import axios from 'axios'

export function getAPIBase(): string {
  const mode = localStorage.getItem('crowforge_deployment_mode') || 'local'
  let base: string
  if (mode === 'connect') {
    base = (localStorage.getItem('crowforge_server_url') || 'http://127.0.0.1:8000').replace(/\/+$/, '')
  } else {
    const port = localStorage.getItem('crowforge_host_port') || '8000'
    base = `http://127.0.0.1:${port}`
  }
  return base
}

export function getAPIHeaders(): Record<string, string> {
  const mode = localStorage.getItem('crowforge_deployment_mode') || 'local'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (mode === 'connect') {
    const key = localStorage.getItem('crowforge_server_api_key') || ''
    if (key) headers['X-API-Key'] = key
  } else if (mode === 'host') {
    const key = localStorage.getItem('crowforge_host_api_key') || ''
    if (key) headers['X-API-Key'] = key
  }
  return headers
}

export function apiUrl(path: string): string {
  return `${getAPIBase()}${path}`
}

/** Always-local URL for sidecar health checks (Tauri always starts backend locally) */
export const LOCAL_API_BASE = 'http://127.0.0.1:8000'

/** Sync axios global defaults with current deployment API key. Call after saving deployment config. */
export function syncAxiosDefaults(): void {
  const headers = getAPIHeaders()
  const key = headers['X-API-Key']
  if (key) {
    axios.defaults.headers.common['X-API-Key'] = key
  } else {
    delete axios.defaults.headers.common['X-API-Key']
  }
}

/** Build a URL with API key as query param (for EventSource which can't set headers). */
export function apiUrlWithAuth(path: string): string {
  const base = `${getAPIBase()}${path}`
  const mode = localStorage.getItem('crowforge_deployment_mode') || 'local'
  if (mode === 'local') return base
  const key = mode === 'connect'
    ? localStorage.getItem('crowforge_server_api_key') || ''
    : localStorage.getItem('crowforge_host_api_key') || ''
  if (!key) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}api_key=${encodeURIComponent(key)}`
}
