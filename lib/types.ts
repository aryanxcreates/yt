export interface ChannelEntry {
  channelUrl: string
}

export interface PostedComment {
  type: 'first' | 'follow_up'
  text: string
  videoId: string
  videoTitle?: string
  threadId?: string
  postedAt: string
}

export interface ChannelConfig {
  channelId: string
  channelUrl: string
  channelTitle: string
  uploadsPlaylistId: string
  accountIndex: number
  accountName?: string

  status: 'active' | 'error' | 'pending'
  error?: string
  lastChecked?: string
  lastCommentedAt?: string
  lastVideoId?: string
  lastVideoTitle?: string
  lastVideoPublishedAt?: string

  // Full history of every comment posted on this channel (first + follow-ups).
  comments?: PostedComment[]

  firstCommentVideoId?: string
  firstCommentThreadId?: string
  firstCommentPostedAt?: string
  // Thread of the most recent comment — the one we poll for a creator reply.
  lastThreadId?: string
  awaitingReply?: boolean

  creatorReplied?: boolean
  followUpVideoId?: string
  followUpPostedAt?: string
}

export interface ProcessResult {
  channelId: string
  channelTitle: string
  videoId?: string
  videoTitle?: string
  action: 'first_comment' | 'follow_up' | 'reply_check' | 'skipped' | 'error'
  commented: boolean
  skipped: boolean
  error?: string
}
