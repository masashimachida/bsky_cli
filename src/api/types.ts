export interface Author {
  did: string
  handle: string
  displayName?: string
  avatarUrl?: string
}

export interface ImageAttachment {
  thumbUrl: string
  fullsizeUrl: string
  alt: string
}

export type QuotedPost =
  | { status: 'available'; author: Author; text: string; createdAt: string }
  | { status: 'not-found' }
  | { status: 'blocked' }
  | { status: 'detached' }

export interface PostSummary {
  uri: string
  cid: string
  author: Author
  text: string
  createdAt: string
  images: ImageAttachment[]
  hasVideo: boolean
  replyCount: number
  repostCount: number
  likeCount: number
  viewerLikeUri?: string
  viewerRepostUri?: string
  quotedPost?: QuotedPost
}

export interface TimelineItem {
  post: PostSummary
  repostedBy?: Author
  replyToHandle?: string
  connectsToNext?: boolean
}

export interface NotificationItem {
  uri: string
  author: Author
  reason: 'like' | 'repost' | 'follow' | 'mention' | 'reply' | 'quote' | 'other'
  reasonSubjectUri?: string
  isRead: boolean
  indexedAt: string
  subjectPost?: PostSummary
  replyToHandle?: string
}
