import type { Author, ImageAttachment, NotificationItem, PostSummary, QuotedPost, TimelineItem } from './types.js'

interface RawAuthor {
  did: string
  handle: string
  displayName?: string
  avatar?: string
}

interface RawPostRecord {
  text: string
  createdAt: string
}

interface RawImagesEmbed {
  $type: 'app.bsky.embed.images#view'
  images: Array<{ thumb: string; fullsize: string; alt: string }>
}

interface RawVideoEmbed {
  $type: 'app.bsky.embed.video#view'
}

interface RawViewRecord {
  $type: 'app.bsky.embed.record#viewRecord'
  author: RawAuthor
  value: { text: string; createdAt: string }
}

type RawEmbedRecordResult = RawViewRecord | { $type?: string }

interface RawRecordEmbed {
  $type: 'app.bsky.embed.record#view'
  record: RawEmbedRecordResult
}

interface RawRecordWithMediaEmbed {
  $type: 'app.bsky.embed.recordWithMedia#view'
  record: { record: RawEmbedRecordResult }
  media?: RawImagesEmbed | RawVideoEmbed | { $type?: string }
}

type RawEmbed = RawImagesEmbed | RawVideoEmbed | RawRecordEmbed | RawRecordWithMediaEmbed | { $type: string } | undefined

function isViewRecord(v: RawEmbedRecordResult): v is RawViewRecord {
  return v.$type === 'app.bsky.embed.record#viewRecord'
}

function extractQuotedPost(embed: RawEmbed): QuotedPost | undefined {
  const recordResult =
    embed?.$type === 'app.bsky.embed.record#view'
      ? (embed as RawRecordEmbed).record
      : embed?.$type === 'app.bsky.embed.recordWithMedia#view'
        ? (embed as RawRecordWithMediaEmbed).record.record
        : undefined
  if (!recordResult) return undefined
  if (isViewRecord(recordResult)) {
    return {
      status: 'available',
      author: toAuthor(recordResult.author),
      text: recordResult.value.text,
      createdAt: recordResult.value.createdAt,
    }
  }
  if (recordResult.$type === 'app.bsky.embed.record#viewNotFound') return { status: 'not-found' }
  if (recordResult.$type === 'app.bsky.embed.record#viewBlocked') return { status: 'blocked' }
  if (recordResult.$type === 'app.bsky.embed.record#viewDetached') return { status: 'detached' }
  return undefined
}

function extractImagesEmbed(embed: RawEmbed): RawImagesEmbed | undefined {
  if (embed?.$type === 'app.bsky.embed.images#view') return embed as RawImagesEmbed
  if (embed?.$type === 'app.bsky.embed.recordWithMedia#view') {
    const media = (embed as RawRecordWithMediaEmbed).media
    if (media?.$type === 'app.bsky.embed.images#view') return media as RawImagesEmbed
  }
  return undefined
}

interface RawPostView {
  uri: string
  cid: string
  author: RawAuthor
  record: RawPostRecord
  embed?: RawEmbed
  replyCount?: number
  repostCount?: number
  likeCount?: number
  viewer?: { like?: string; repost?: string }
}

interface RawReasonRepost {
  $type: 'app.bsky.feed.defs#reasonRepost'
  by: RawAuthor
}

interface RawNotFoundOrBlockedPost {
  $type?: string
  uri?: string
  author?: RawAuthor
}

type RawReplyPostRef = RawPostView | RawNotFoundOrBlockedPost

function isRawPostView(v: RawReplyPostRef): v is RawPostView {
  return 'record' in v
}

interface RawReplyRef {
  root: RawReplyPostRef
  parent: RawReplyPostRef
}

interface RawFeedViewPost {
  post: RawPostView
  reason?: RawReasonRepost | { $type: string }
  reply?: RawReplyRef
}

interface RawNotification {
  uri: string
  author: RawAuthor
  reason: string
  reasonSubject?: string
  isRead: boolean
  indexedAt: string
}

const KNOWN_NOTIFICATION_REASONS = ['like', 'repost', 'follow', 'mention', 'reply', 'quote'] as const

// Bluesky CDN（cdn.bsky.app）の画像URLは拡張子サフィックス（@jpeg等）を付けずにリクエストすると
// WebP形式で返ってくる。依存ライブラリink-pictureが使うJimpはデフォルトでWebPデコードに対応していないため、
// サフィックスを付与してJPEG形式で取得させる。既にサフィックスが付いているURLには二重付与しない。
function withJpegSuffix(url: string): string {
  return url.includes('@') ? url : `${url}@jpeg`
}

export function formatRelativeTime(createdAt: string, now: Date = new Date()): string {
  const created = new Date(createdAt)
  const diffMs = now.getTime() - created.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'たった今'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}分前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}時間前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}日前`
  const y = created.getFullYear()
  const m = String(created.getMonth() + 1).padStart(2, '0')
  const d = String(created.getDate()).padStart(2, '0')
  return `${y}/${m}/${d}`
}

export function toAuthor(raw: RawAuthor): Author {
  return {
    did: raw.did,
    handle: raw.handle,
    displayName: raw.displayName,
    avatarUrl: raw.avatar ? withJpegSuffix(raw.avatar) : undefined,
  }
}

export function toPostSummary(post: RawPostView): PostSummary {
  const imagesEmbed = extractImagesEmbed(post.embed)
  const images: ImageAttachment[] = imagesEmbed
    ? imagesEmbed.images.map((img) => ({
        thumbUrl: withJpegSuffix(img.thumb),
        fullsizeUrl: withJpegSuffix(img.fullsize),
        alt: img.alt,
      }))
    : []

  return {
    uri: post.uri,
    cid: post.cid,
    author: toAuthor(post.author),
    text: post.record.text,
    createdAt: post.record.createdAt,
    images,
    hasVideo: post.embed?.$type === 'app.bsky.embed.video#view',
    replyCount: post.replyCount ?? 0,
    repostCount: post.repostCount ?? 0,
    likeCount: post.likeCount ?? 0,
    viewerLikeUri: post.viewer?.like,
    viewerRepostUri: post.viewer?.repost,
    quotedPost: extractQuotedPost(post.embed),
  }
}

export function toTimelineItems(feedViewPost: RawFeedViewPost): TimelineItem[] {
  const reason = feedViewPost.reason
  const repostedBy =
    reason?.$type === 'app.bsky.feed.defs#reasonRepost' ? toAuthor((reason as RawReasonRepost).by) : undefined

  const items: TimelineItem[] = []
  const root = feedViewPost.reply?.root
  const parent = feedViewPost.reply?.parent
  let replyToHandle: string | undefined

  if (parent) {
    if (!repostedBy) {
      if (root && isRawPostView(root) && root.uri !== parent.uri) {
        items.push({ post: toPostSummary(root), connectsToNext: true })
      }
      if (isRawPostView(parent)) {
        items.push({ post: toPostSummary(parent), connectsToNext: true })
      }
    }
    replyToHandle = isRawPostView(parent) ? parent.author.handle : parent.author?.handle
  }

  items.push({
    post: toPostSummary(feedViewPost.post),
    repostedBy,
    replyToHandle,
  })
  return items
}

export function toNotificationItem(n: RawNotification): NotificationItem {
  const isKnown = (KNOWN_NOTIFICATION_REASONS as readonly string[]).includes(n.reason)
  return {
    uri: n.uri,
    author: toAuthor(n.author),
    reason: isKnown ? (n.reason as NotificationItem['reason']) : 'other',
    reasonSubjectUri: n.reasonSubject,
    isRead: n.isRead,
    indexedAt: n.indexedAt,
  }
}
