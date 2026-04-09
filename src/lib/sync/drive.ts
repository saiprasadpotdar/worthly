/**
 * Google Drive Backup & Sync
 *
 * Client-side only — uses Google Identity Services (GIS) for OAuth
 * and Google Drive REST API to store a single JSON backup file.
 */

const CLIENT_ID = '' // User must set this in settings
const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const BACKUP_FILENAME = 'worthly-backup.json'
const BACKUP_MIME = 'application/json'

// ─── Token Management ───────────────────────────────────────────

interface TokenInfo {
  access_token: string
  expires_at: number
}

function getStoredToken(): TokenInfo | null {
  try {
    const raw = localStorage.getItem('worthly-gdrive-token')
    if (!raw) return null
    const token = JSON.parse(raw) as TokenInfo
    if (Date.now() > token.expires_at - 60_000) return null // expired or about to
    return token
  } catch {
    return null
  }
}

function storeToken(accessToken: string, expiresIn: number) {
  const info: TokenInfo = {
    access_token: accessToken,
    expires_at: Date.now() + expiresIn * 1000,
  }
  localStorage.setItem('worthly-gdrive-token', JSON.stringify(info))
}

export function clearDriveToken() {
  localStorage.removeItem('worthly-gdrive-token')
  localStorage.removeItem('worthly-gdrive-client-id')
  localStorage.removeItem('worthly-gdrive-last-backup')
}

export function getDriveClientId(): string {
  return localStorage.getItem('worthly-gdrive-client-id') ?? ''
}

export function setDriveClientId(id: string) {
  localStorage.setItem('worthly-gdrive-client-id', id)
}

export function getLastBackupTime(): string | null {
  return localStorage.getItem('worthly-gdrive-last-backup')
}

export function isConnected(): boolean {
  return getStoredToken() !== null
}

// ─── OAuth via GIS ──────────────────────────────────────────────

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('gis-script')) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.id = 'gis-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

export async function authorize(): Promise<string> {
  const clientId = getDriveClientId()
  if (!clientId) throw new Error('Google Client ID not configured. Set it in Settings.')

  // Check for existing valid token
  const existing = getStoredToken()
  if (existing) return existing.access_token

  await loadGisScript()

  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error))
          return
        }
        storeToken(response.access_token, response.expires_in)
        resolve(response.access_token)
      },
      error_callback: (err: any) => {
        reject(new Error(err.message || 'OAuth failed'))
      },
    })
    client.requestAccessToken()
  })
}

// ─── Drive API Operations ───────────────────────────────────────

async function findBackupFile(token: string): Promise<string | null> {
  const query = `name='${BACKUP_FILENAME}' and mimeType='${BACKUP_MIME}' and trashed=false`
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`)
  const data = await res.json()
  return data.files?.[0]?.id ?? null
}

export async function uploadBackup(jsonData: string): Promise<void> {
  const token = await authorize()
  const existingId = await findBackupFile(token)

  if (existingId) {
    // Update existing file
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': BACKUP_MIME,
        },
        body: jsonData,
      }
    )
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  } else {
    // Create new file with multipart upload
    const metadata = {
      name: BACKUP_FILENAME,
      mimeType: BACKUP_MIME,
    }
    const boundary = '---worthly-boundary'
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${BACKUP_MIME}`,
      '',
      jsonData,
      `--${boundary}--`,
    ].join('\r\n')

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    )
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  }

  localStorage.setItem('worthly-gdrive-last-backup', new Date().toISOString())
}

export async function downloadBackup(): Promise<string> {
  const token = await authorize()
  const fileId = await findBackupFile(token)
  if (!fileId) throw new Error('No backup found on Google Drive.')

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  return res.text()
}
