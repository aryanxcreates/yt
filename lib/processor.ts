import { getLatestVideo, getVideoContent, getVideoTranscript, postComment, checkCreatorReplied, resolveChannelId, describeApiError, getAccountName } from './youtube'
import { getChannels, setChannels, getSheetUrl, setLastRun } from './store'
import { generateFirstComment, generateFollowUpComment } from './claude'
import { extractSpreadsheetId, parseGoogleSheet } from './sheets'
import type { ChannelConfig, PostedComment, ProcessResult } from './types'

const DELAY_MS = 500

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function syncFromStoredSheet(): Promise<void> {
  const url = await getSheetUrl()
  if (!url) return
  const spreadsheetId = extractSpreadsheetId(url)
  if (!spreadsheetId) return

  try {
    const entries = await parseGoogleSheet(spreadsheetId)
    const channels = await getChannels()
    const existingUrls = new Set(channels.map((c) => c.channelUrl))
    const toAdd = entries.filter((e) => !existingUrls.has(e.channelUrl))
    if (!toAdd.length) return

    const newChannels: ChannelConfig[] = []
    for (const entry of toAdd) {
      try {
        const { id, title, uploadsPlaylistId } = await resolveChannelId(entry.channelUrl)
        newChannels.push({
          channelUrl: entry.channelUrl,
          channelId: id,
          channelTitle: title,
          uploadsPlaylistId,
          accountIndex: (channels.length + newChannels.length) % 3,
          status: 'pending',
        })
      } catch { /* skip unresolvable URLs */ }
    }
    if (newChannels.length) await setChannels([...channels, ...newChannels])
  } catch { /* don't break the cron if sheet is unreachable */ }
}

export async function processChannels(): Promise<ProcessResult[]> {
  await syncFromStoredSheet()

  const channels = await getChannels()
  const results: ProcessResult[] = []
  const updated: ChannelConfig[] = []

  for (const channel of channels) {
    const result: ProcessResult = {
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
      commented: false,
      skipped: false,
      action: 'skipped',
    }

    try {
      const accountName = getAccountName(channel.accountIndex)
      const video = await getLatestVideo(channel.uploadsPlaylistId)

      if (!video) {
        result.skipped = true
        updated.push({ ...channel, accountName, lastChecked: new Date().toISOString() })
        results.push(result)
        await sleep(DELAY_MS)
        continue
      }

      result.videoId = video.id
      result.videoTitle = video.title

      const isNewVideo = video.id !== channel.lastVideoId

      if (isNewVideo) {
        if (!channel.lastVideoId) {
          // Channel just added — record baseline, never comment on the existing video
          result.skipped = true
          updated.push({
            ...channel,
            accountName,
            lastVideoId: video.id,
            lastVideoTitle: video.title,
            lastVideoPublishedAt: video.publishedAt,
            lastChecked: new Date().toISOString(),
            status: 'active',
          })
          results.push(result)
          await sleep(DELAY_MS)
          continue
        } else if (channel.creatorReplied) {
          // Creator already replied — cycle complete, just track the new video
          result.skipped = true
          updated.push({
            ...channel,
            accountName,
            lastVideoId: video.id,
            lastVideoTitle: video.title,
            lastVideoPublishedAt: video.publishedAt,
            lastChecked: new Date().toISOString(),
            status: 'active',
          })
          results.push(result)
          await sleep(DELAY_MS)
          continue
        } else if (channel.awaitingReply) {
          // New video — creator still hasn't replied, post another follow-up.
          // Keep awaitingReply=true so we keep following up on every new video
          // until the creator finally replies.
          const { title, description } = await getVideoContent(video.id)
          const transcript = await getVideoTranscript(video.id)
          const comment = await generateFollowUpComment(title, description, channel.channelTitle, transcript)
          const postedAt = new Date().toISOString()
          const threadId = await postComment(video.id, comment, channel.accountIndex)
          const entry: PostedComment = {
            type: 'follow_up',
            text: comment,
            videoId: video.id,
            videoTitle: video.title,
            threadId,
            postedAt,
          }
          result.action = 'follow_up'
          result.commented = true
          updated.push({
            ...channel,
            accountName,
            lastVideoId: video.id,
            lastVideoTitle: video.title,
            lastVideoPublishedAt: video.publishedAt,
            lastChecked: new Date().toISOString(),
            lastCommentedAt: postedAt,
            comments: [...(channel.comments ?? []), entry],
            lastThreadId: threadId,
            awaitingReply: true,
            followUpVideoId: video.id,
            followUpPostedAt: postedAt,
            status: 'active',
            error: undefined,
          })
        } else {
          // New video, never commented yet — post the first comment
          const { title, description } = await getVideoContent(video.id)
          const transcript = await getVideoTranscript(video.id)
          const comment = await generateFirstComment(title, description, channel.channelTitle, transcript)
          const postedAt = new Date().toISOString()
          const threadId = await postComment(video.id, comment, channel.accountIndex)
          const entry: PostedComment = {
            type: 'first',
            text: comment,
            videoId: video.id,
            videoTitle: video.title,
            threadId,
            postedAt,
          }
          result.action = 'first_comment'
          result.commented = true
          updated.push({
            ...channel,
            accountName,
            lastVideoId: video.id,
            lastVideoTitle: video.title,
            lastVideoPublishedAt: video.publishedAt,
            lastChecked: new Date().toISOString(),
            lastCommentedAt: postedAt,
            comments: [...(channel.comments ?? []), entry],
            firstCommentVideoId: video.id,
            firstCommentThreadId: threadId,
            firstCommentPostedAt: postedAt,
            lastThreadId: threadId,
            awaitingReply: true,
            creatorReplied: false,
            followUpVideoId: undefined,
            followUpPostedAt: undefined,
            status: 'active',
            error: undefined,
          })
        }
      } else {
        // Same video — check for a creator reply on our most recent comment
        const threadToCheck = channel.lastThreadId ?? channel.firstCommentThreadId
        if (channel.awaitingReply && threadToCheck) {
          const replied = await checkCreatorReplied(threadToCheck, channel.channelId)
          result.action = 'reply_check'
          updated.push({
            ...channel,
            accountName,
            lastChecked: new Date().toISOString(),
            ...(replied ? { awaitingReply: false, creatorReplied: true } : {}),
            status: 'active',
          })
        } else {
          result.skipped = true
          updated.push({
            ...channel,
            accountName,
            lastChecked: new Date().toISOString(),
            status: 'active',
          })
        }
      }
    } catch (err) {
      const error = describeApiError(err)
      result.action = 'error'
      result.error = error
      updated.push({
        ...channel,
        status: 'error',
        error,
        lastChecked: new Date().toISOString(),
      })
    }

    results.push(result)
    await sleep(DELAY_MS)
  }

  await setChannels(updated)
  await setLastRun(new Date().toISOString())
  return results
}
