import { google } from 'googleapis'
import accountNames from './accounts.json'

/**
 * Google OAuth/API errors (GaxiosError) carry the useful detail in
 * `response.data`, e.g. `{ error: 'unauthorized_client', error_description: '...' }`.
 * `err.message` alone usually only shows the bare error code, so pull out the
 * description when it's available.
 */
export function describeApiError(err: unknown): string {
  if (err && typeof err === 'object') {
    const data = (err as { response?: { data?: unknown } }).response?.data
    if (data && typeof data === 'object') {
      const { error, error_description } = data as {
        error?: unknown
        error_description?: unknown
      }
      const code = typeof error === 'string' ? error : undefined
      const desc = typeof error_description === 'string' ? error_description : undefined
      if (code && desc) return `${code}: ${desc}`
      if (desc) return desc
      if (code) return code
    }
  }
  return err instanceof Error ? err.message : String(err)
}

const ACCOUNTS = [
  {
    clientId: process.env.YOUTUBE_ACCOUNT_1_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_ACCOUNT_1_CLIENT_SECRET,
    refreshToken: process.env.YOUTUBE_ACCOUNT_1_REFRESH_TOKEN,
  },
  {
    clientId: process.env.YOUTUBE_ACCOUNT_2_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_ACCOUNT_2_CLIENT_SECRET,
    refreshToken: process.env.YOUTUBE_ACCOUNT_2_REFRESH_TOKEN,
  },
  {
    clientId: process.env.YOUTUBE_ACCOUNT_3_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_ACCOUNT_3_CLIENT_SECRET,
    refreshToken: process.env.YOUTUBE_ACCOUNT_3_REFRESH_TOKEN,
  },
]

function getOAuth2Client(accountIndex: number) {
  const account = ACCOUNTS[accountIndex]
  if (!account?.clientId || !account?.refreshToken) {
    throw new Error(`YouTube account ${accountIndex + 1} credentials not configured`)
  }
  const auth = new google.auth.OAuth2(account.clientId, account.clientSecret)
  auth.setCredentials({ refresh_token: account.refreshToken })
  return auth
}

function ytRead() {
  return google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY })
}

function ytWrite(accountIndex: number) {
  return google.youtube({ version: 'v3', auth: getOAuth2Client(accountIndex) })
}

export function getAccountName(accountIndex: number): string {
  return accountNames[accountIndex] ?? `Account ${accountIndex + 1}`
}

export async function resolveChannelId(url: string): Promise<{
  id: string
  title: string
  uploadsPlaylistId: string
}> {
  const yt = ytRead()
  let channelId: string | null = null

  const directMatch = url.match(/\/channel\/(UC[\w-]+)/)
  if (directMatch) channelId = directMatch[1]

  if (!channelId) {
    const handleMatch = url.match(/\/@([\w.-]+)/)
    if (handleMatch) {
      const res = await yt.channels.list({ part: ['id'], forHandle: handleMatch[1] })
      channelId = res.data.items?.[0]?.id ?? null
      if (!channelId) throw new Error(`Channel not found for handle @${handleMatch[1]}`)
    }
  }

  if (!channelId) {
    const userMatch = url.match(/\/user\/([\w.-]+)/)
    if (userMatch) {
      const res = await yt.channels.list({ part: ['id'], forUsername: userMatch[1] })
      channelId = res.data.items?.[0]?.id ?? null
      if (!channelId) throw new Error(`Channel not found for username ${userMatch[1]}`)
    }
  }

  if (!channelId) throw new Error(`Cannot parse YouTube URL: ${url}`)

  const details = await yt.channels.list({
    part: ['snippet', 'contentDetails'],
    id: [channelId],
  })
  const channel = details.data.items?.[0]
  if (!channel) throw new Error(`Channel data not found for ID: ${channelId}`)

  return {
    id: channelId,
    title: channel.snippet?.title ?? channelId,
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads ?? '',
  }
}

export async function getLatestVideo(uploadsPlaylistId: string): Promise<{
  id: string
  title: string
  publishedAt: string
} | null> {
  const yt = ytRead()
  const res = await yt.playlistItems.list({
    part: ['snippet', 'contentDetails'],
    playlistId: uploadsPlaylistId,
    maxResults: 1,
  })
  const item = res.data.items?.[0]
  if (!item?.contentDetails?.videoId) return null
  return {
    id: item.contentDetails.videoId,
    title: item.snippet?.title ?? '',
    publishedAt: item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt ?? '',
  }
}

export async function getVideoContent(videoId: string): Promise<{
  title: string
  description: string
}> {
  const yt = ytRead()
  const res = await yt.videos.list({
    part: ['snippet'],
    id: [videoId],
  })
  const video = res.data.items?.[0]
  return {
    title: video?.snippet?.title ?? '',
    description: video?.snippet?.description ?? '',
  }
}

export async function postComment(
  videoId: string,
  comment: string,
  accountIndex: number
): Promise<string> {
  const yt = ytWrite(accountIndex)
  const res = await yt.commentThreads.insert({
    part: ['snippet'],
    requestBody: {
      snippet: {
        videoId,
        topLevelComment: {
          snippet: { textOriginal: comment },
        },
      },
    },
  })
  const threadId = res.data.id
  if (!threadId) throw new Error('No thread ID returned from YouTube API')
  return threadId
}

export async function getVideoTranscript(videoId: string): Promise<string | null> {
  try {
    const { YoutubeTranscript } = await import('youtube-transcript')
    const segments = await YoutubeTranscript.fetchTranscript(videoId)
    return segments.map((s) => s.text).join(' ').trim() || null
  } catch {
    return null
  }
}

export async function checkCreatorReplied(
  threadId: string,
  channelId: string
): Promise<boolean> {
  const yt = ytRead()
  const res = await yt.commentThreads.list({
    part: ['replies'],
    id: [threadId],
  })
  const thread = res.data.items?.[0]
  const replies = thread?.replies?.comments ?? []
  return replies.some((r) => r.snippet?.authorChannelId?.value === channelId)
}
