import * as XLSX from 'xlsx'
import type { ChannelEntry } from './types'

export function parseExcelBuffer(buffer: Buffer): ChannelEntry[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
  }) as string[][]

  const firstCell = String(rows[0]?.[0] ?? '').toLowerCase()
  const startIdx =
    firstCell.includes('channel') || firstCell.includes('url') ? 1 : 0

  const entries: ChannelEntry[] = []
  for (let i = startIdx; i < rows.length; i++) {
    const channelUrl = String(rows[i][0] ?? '').trim()
    if (channelUrl && channelUrl.toLowerCase().includes('youtube.com')) {
      entries.push({ channelUrl })
    }
  }
  return entries
}
