import { getLatestVideo, getVideoContent, postComment, checkCreatorReplied } from './youtube'
import { getChannels, setChannels } from './store'
import { generateFirstComment, generateFollowUpComment } from './claude'
import type { ChannelConfig, ProcessResult } from './types'

const DELAY_MS = 500
const MAX_VIDEO_AGE_MS = 24 * 60 * 60 * 1000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function processChannels(): Promise<ProcessResult[]> {
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
      const video = await getLatestVideo(channel.uploadsPlaylistId)

      if (!video) {
        result.skipped = true
        updated.push({ ...channel, lastChecked: new Date().toISOString() })
        results.push(result)
        await sleep(DELAY_MS)
        continue
      }

      result.videoId = video.id
      result.videoTitle = video.title

      const isNewVideo = video.id !== channel.lastVideoId

      if (isNewVideo) {
        const videoAgeMs = Date.now() - new Date(video.publishedAt).getTime()
        const isTooOld = videoAgeMs > MAX_VIDEO_AGE_MS && !channel.firstCommentVideoId

        if (isTooOld) {
          // Newly added channel with only old content — establish baseline without commenting
          result.skipped = true
          updated.push({
            ...channel,
            lastVideoId: video.id,
            lastVideoTitle: video.title,
            lastChecked: new Date().toISOString(),
            status: 'active',
          })
        } else if (channel.awaitingReply) {
          // New video — creator never replied to first comment, post follow-up
          const { title, description } = await getVideoContent(video.id)
          const comment = await generateFollowUpComment(title, description, channel.channelTitle)
          await postComment(video.id, comment, channel.accountIndex)
          result.action = 'follow_up'
          result.commented = true
          updated.push({
            ...channel,
            lastVideoId: video.id,
            lastVideoTitle: video.title,
            lastChecked: new Date().toISOString(),
            lastCommentedAt: new Date().toISOString(),
            awaitingReply: false,
            followUpVideoId: video.id,
            followUpPostedAt: new Date().toISOString(),
            status: 'active',
            error: undefined,
          })
        } else {
          // New video, not awaiting reply — post first comment
          const { title, description } = await getVideoContent(video.id)
          const comment = await generateFirstComment(title, description, channel.channelTitle)
          const threadId = await postComment(video.id, comment, channel.accountIndex)
          result.action = 'first_comment'
          result.commented = true
          updated.push({
            ...channel,
            lastVideoId: video.id,
            lastVideoTitle: video.title,
            lastChecked: new Date().toISOString(),
            lastCommentedAt: new Date().toISOString(),
            firstCommentVideoId: video.id,
            firstCommentThreadId: threadId,
            firstCommentPostedAt: new Date().toISOString(),
            awaitingReply: true,
            creatorReplied: false,
            followUpVideoId: undefined,
            followUpPostedAt: undefined,
            status: 'active',
            error: undefined,
          })
        }
      } else {
        // Same video — check for creator reply if we're waiting on one
        if (channel.awaitingReply && channel.firstCommentThreadId) {
          const replied = await checkCreatorReplied(channel.firstCommentThreadId, channel.channelId)
          result.action = 'reply_check'
          updated.push({
            ...channel,
            lastChecked: new Date().toISOString(),
            ...(replied ? { awaitingReply: false, creatorReplied: true } : {}),
            status: 'active',
          })
        } else {
          result.skipped = true
          updated.push({
            ...channel,
            lastChecked: new Date().toISOString(),
            status: 'active',
          })
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
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
  return results
}
