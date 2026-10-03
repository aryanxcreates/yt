import { google } from 'googleapis'
import type { ChannelEntry } from './types'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  const credentials = JSON.parse(raw)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([\w-]+)/)
  return match?.[1] ?? null
}

export async function parseGoogleSheet(spreadsheetId: string): Promise<ChannelEntry[]> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'A:A',
  })

  const rows = res.data.values ?? []
  const entries: ChannelEntry[] = []

  for (const row of rows) {
    const channelUrl = String(row[0] ?? '').trim()
    if (channelUrl && channelUrl.toLowerCase().includes('youtube.com')) {
      entries.push({ channelUrl })
    }
  }

  return entries
}
