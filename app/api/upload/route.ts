import { NextRequest, NextResponse } from 'next/server'
import { parseExcelBuffer } from '@/lib/excel'
import { resolveChannelId } from '@/lib/youtube'
import { getChannels, setChannels } from '@/lib/store'
import type { ChannelConfig } from '@/lib/types'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file)
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const entries = parseExcelBuffer(buffer)

  if (!entries.length) {
    return NextResponse.json(
      { error: 'No valid rows found. Ensure Column A = YouTube channel URL.' },
      { status: 400 }
    )
  }

  const existing = await getChannels()
  const existingUrls = new Set(existing.map((c) => c.channelUrl))
  const toAdd = entries.filter((e) => !existingUrls.has(e.channelUrl))

  const added: ChannelConfig[] = []
  const errors: string[] = []

  for (const entry of toAdd) {
    try {
      const { id, title, uploadsPlaylistId } = await resolveChannelId(entry.channelUrl)
      added.push({
        channelUrl: entry.channelUrl,
        channelId: id,
        channelTitle: title,
        uploadsPlaylistId,
        accountIndex: (existing.length + added.length) % 3,
        status: 'pending',
      })
    } catch (err) {
      errors.push(
        `${entry.channelUrl}: ${err instanceof Error ? err.message : 'unknown error'}`
      )
    }
  }

  await setChannels([...existing, ...added])
  return NextResponse.json({
    success: true,
    added: added.length,
    skipped: entries.length - toAdd.length,
    errors,
  })
}
