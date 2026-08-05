import type { AtpClient } from './atp-client.js'
import { toNotificationItem, toPostSummary, toTimelineItems } from './format.js'
import type { NotificationItem, PostSummary, TimelineItem } from './types.js'

const GET_POSTS_CHUNK_SIZE = 25

function subjectUriForNotification(n: NotificationItem): string | undefined {
  if (n.reason === 'like' || n.reason === 'repost') return n.reasonSubjectUri
  if (n.reason === 'quote' || n.reason === 'reply') return n.uri
  return undefined
}

function replyParentUriForNotification(n: NotificationItem): string | undefined {
  return n.reason === 'reply' ? n.reasonSubjectUri : undefined
}

async function fetchPostsByUri(client: AtpClient, uris: string[]): Promise<Map<string, PostSummary>> {
  const byUri = new Map<string, PostSummary>()
  for (let i = 0; i < uris.length; i += GET_POSTS_CHUNK_SIZE) {
    const chunk = uris.slice(i, i + GET_POSTS_CHUNK_SIZE)
    const res = await client.getPosts({ uris: chunk })
    for (const post of res.data.posts) {
      byUri.set(post.uri, toPostSummary(post as never))
    }
  }
  return byUri
}

export interface Page<T> {
  items: T[]
  cursor?: string
}

const PAGE_SIZE = 30

export async function fetchTimeline(client: AtpClient, cursor?: string): Promise<Page<TimelineItem>> {
  const res = await client.getTimeline({ cursor, limit: PAGE_SIZE })
  return { items: res.data.feed.flatMap((f) => toTimelineItems(f as never)), cursor: res.data.cursor }
}

export async function fetchAuthorFeed(client: AtpClient, actor: string, cursor?: string): Promise<Page<TimelineItem>> {
  const res = await client.getAuthorFeed({ actor, cursor, limit: PAGE_SIZE })
  return { items: res.data.feed.flatMap((f) => toTimelineItems(f as never)), cursor: res.data.cursor }
}

// 返信先の複製(connectsToNextのみのプレースホルダ)と、同じ投稿が別のfeedエントリで
// 本体(replyToHandle付き)として登場したものが重複する場合、両方の情報をマージする。
// 表示位置は最初に登場した位置を採用する。
export function dedupeTimelineItems(items: TimelineItem[]): TimelineItem[] {
  const mergedByUri = new Map<string, TimelineItem>()
  for (const item of items) {
    const existing = mergedByUri.get(item.post.uri)
    if (!existing) {
      mergedByUri.set(item.post.uri, item)
      continue
    }
    mergedByUri.set(item.post.uri, {
      ...existing,
      ...item,
      connectsToNext: existing.connectsToNext || item.connectsToNext,
      replyToHandle: existing.replyToHandle ?? item.replyToHandle,
      repostedBy: existing.repostedBy ?? item.repostedBy,
    })
  }
  const seen = new Set<string>()
  const result: TimelineItem[] = []
  for (const item of items) {
    if (seen.has(item.post.uri)) continue
    seen.add(item.post.uri)
    result.push(mergedByUri.get(item.post.uri)!)
  }
  return result
}

export async function fetchNotifications(client: AtpClient, cursor?: string): Promise<Page<NotificationItem>> {
  const res = await client.listNotifications({ cursor, limit: PAGE_SIZE })
  const items = res.data.notifications.map((n) => toNotificationItem(n as never))

  const allUris = Array.from(
    new Set(
      items.flatMap((item) => [subjectUriForNotification(item), replyParentUriForNotification(item)]).filter((uri): uri is string => !!uri),
    ),
  )
  if (allUris.length === 0) return { items, cursor: res.data.cursor }

  try {
    const postsByUri = await fetchPostsByUri(client, allUris)
    const enriched = items
      .map((item) => {
        const subjectUri = subjectUriForNotification(item)
        const subjectPost = subjectUri ? postsByUri.get(subjectUri) : undefined
        const parentUri = replyParentUriForNotification(item)
        const replyToHandle = parentUri ? postsByUri.get(parentUri)?.author.handle : undefined
        return { ...item, ...(subjectPost && { subjectPost }), ...(replyToHandle && { replyToHandle }) }
      })
      .filter((item) => {
        const subjectUri = subjectUriForNotification(item)
        return !((item.reason === 'like' || item.reason === 'repost') && subjectUri && !item.subjectPost)
      })
    return { items: enriched, cursor: res.data.cursor }
  } catch {
    return { items, cursor: res.data.cursor }
  }
}

export async function fetchUnreadCount(client: AtpClient): Promise<number> {
  const res = await client.countUnreadNotifications()
  return res.data.count
}

export async function searchPostsPage(client: AtpClient, query: string, cursor?: string): Promise<Page<PostSummary>> {
  const res = await client.app.bsky.feed.searchPosts({ q: query, cursor, limit: PAGE_SIZE })
  return { items: res.data.posts.map((p) => toPostSummary(p as never)), cursor: res.data.cursor }
}

export async function createPost(
  client: AtpClient,
  text: string,
  reply?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } },
) {
  return client.post({ text, reply })
}

export async function toggleLike(
  client: AtpClient,
  post: PostSummary,
): Promise<{ viewerLikeUri?: string; likeCount: number }> {
  if (post.viewerLikeUri) {
    await client.deleteLike(post.viewerLikeUri)
    return { viewerLikeUri: undefined, likeCount: Math.max(0, post.likeCount - 1) }
  }
  const { uri } = await client.like(post.uri, post.cid)
  return { viewerLikeUri: uri, likeCount: post.likeCount + 1 }
}

export async function toggleRepost(
  client: AtpClient,
  post: PostSummary,
): Promise<{ viewerRepostUri?: string; repostCount: number }> {
  if (post.viewerRepostUri) {
    await client.deleteRepost(post.viewerRepostUri)
    return { viewerRepostUri: undefined, repostCount: Math.max(0, post.repostCount - 1) }
  }
  const { uri } = await client.repost(post.uri, post.cid)
  return { viewerRepostUri: uri, repostCount: post.repostCount + 1 }
}

export async function deletePost(client: AtpClient, post: PostSummary): Promise<void> {
  await client.deletePost(post.uri)
}
