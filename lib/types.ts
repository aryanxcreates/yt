export interface ChannelEntry {
  channelUrl: string
}

export interface ChannelConfig {
  channelId: string
  channelUrl: string
  channelTitle: string
  uploadsPlaylistId: string
  accountIndex: number

  status: 'active' | 'error' | 'pending'
  error?: string
  lastChecked?: string
  lastCommentedAt?: string
  lastVideoId?: string
  lastVideoTitle?: string
  lastVideoPublishedAt?: string

  firstCommentVideoId?: string
  firstCommentThreadId?: string
  firstCommentPostedAt?: string
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
