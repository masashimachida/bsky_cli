import type { AtpClient } from './atp-client.js'
import { toNotificationItem, toPostSummary, toTimelineItems } from './format.js'
import { sanitizeText } from './sanitize.js'
import type { FeedInfo, NotificationItem, PostSummary, TimelineItem } from './types.js'

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

export async function fetchFeed(client: AtpClient, feedUri: string, cursor?: string): Promise<Page<TimelineItem>> {
  const res = await client.app.bsky.feed.getFeed({ feed: feedUri, cursor, limit: PAGE_SIZE })
  return { items: res.data.feed.flatMap((f) => toTimelineItems(f as never)), cursor: res.data.cursor }
}

export async function fetchSavedFeeds(client: AtpClient): Promise<FeedInfo[]> {
  const prefs = await client.getPreferences()
  const feedSaves = prefs.savedFeeds.filter((f) => f.type === 'feed')
  if (feedSaves.length === 0) return []
  const uris = feedSaves.map((f) => f.value)
  const res = await client.app.bsky.feed.getFeedGenerators({ feeds: uris })
  const byUri = new Map(res.data.feeds.map((g) => [g.uri, g]))
  return feedSaves.flatMap((f) => {
    const generator = byUri.get(f.value)
    if (!generator) return []
    return [
      {
        uri: generator.uri,
        displayName: sanitizeText(generator.displayName),
        description: generator.description ? sanitizeText(generator.description) : undefined,
        pinned: f.pinned,
        creatorHandle: generator.creator.handle,
        creatorDisplayName: generator.creator.displayName ? sanitizeText(generator.creator.displayName) : undefined,
      },
    ]
  })
}

// Bluesky公式Web版(bluesky-social/social-app, src/lib/api/feed-manip.ts の FeedTuner.tune)の
// ロジックを移植。各feedエントリ由来のアイテム群を「スライス」(sliceKeyでグループ化、root?→parent?→本体の
// 1〜3件、常に古い→新しい順)として扱い、スライス単位で重複解決する:
// - スライス先頭のアイテムが既に別のスライスで表示済み(seenUris)なら、そのアイテムを剥がして次へ進む
//   例: [A→B→C], [A→D→E], [A→D→F] → [A→B→C], [D→E], [F]
// - 剥がした結果、最後のアイテム(本体)まで既に表示済みなら、スライス全体を破棄する
//   (中間の投稿を失うことになるが、ユーザーはスレッド画面で全体を見られる)
// スライス内の順序は常に維持されるため、post単位でグローバルにマージする旧方式と違い、
// 位置がずれて誤った罫線接続が生じることがない。
//
// seenUrisは呼び出し元(TimelineScreen等)がページをまたいで永続化して渡すことを想定している
// (公式実装のFeedTunerインスタンスがseenUrisを保持し続けるのと同じ理由)。ページ単位で
// 都度新しいSetを作って呼び出すと、既に表示済みのスライスの先頭(root)だけが別ページの
// 「既知」として剥がされ、残りの中間投稿が単独で浮遊表示されてしまう。
//
// seenRootUrisを渡すと、公式実装のFeedTuner.dedupThreadsと同じ「スレッド単位」の重複排除も行う:
// 同じスレッド(reply.root)から2件目以降のフィードエントリが来たら、そのスライスをpost単位の
// 判定に進む前に丸ごと破棄する(リポストは対象外)。これにより、自己リプライ連鎖の中間投稿が
// 離れた位置に単独浮遊表示される問題が根本的に解消される — Followingタイムラインは「1スレッドにつき
// 最新の反応だけを見せる」設計なので、その仕様に合わせている。公式のコメント通り、著者フィードなど
// 「その人の投稿を全部見せたい」場面ではこの引数を渡さないこと。
export function dedupeTimelineItems(items: TimelineItem[], seenUris: Set<string> = new Set(), seenRootUris?: Set<string>): TimelineItem[] {
  const sliceOrder: string[] = []
  const slices = new Map<string, TimelineItem[]>()
  for (const item of items) {
    let slice = slices.get(item.sliceKey)
    if (!slice) {
      slice = []
      slices.set(item.sliceKey, slice)
      sliceOrder.push(item.sliceKey)
    }
    slice.push(item)
  }

  const result: TimelineItem[] = []
  for (const sliceKey of sliceOrder) {
    let sliceItems = slices.get(sliceKey)!

    if (seenRootUris) {
      const rootUri = sliceItems[0].rootUri
      const isRepost = sliceItems.some((it) => it.repostedBy !== undefined)
      if (!isRepost) {
        if (seenRootUris.has(rootUri)) continue
        seenRootUris.add(rootUri)
      }
    }

    while (sliceItems.length > 0 && seenUris.has(sliceItems[0].post.uri)) {
      sliceItems = sliceItems.slice(1)
    }
    if (sliceItems.length === 0) continue
    // 破棄されるスライスでも、未知だったアイテムはseenUrisに記録する(公式実装と同じ挙動)。
    // これにより、破棄された投稿が後続のスライス先頭に再登場した場合も正しく剥がされる。
    const isLastKnown = seenUris.has(sliceItems[sliceItems.length - 1].post.uri)
    for (const item of sliceItems) {
      seenUris.add(item.post.uri)
    }
    if (isLastKnown) continue
    result.push(...sliceItems)
  }
  return result
}

// タイムライン自動更新用。先頭ページ取得結果(newPageItems)から未見の投稿だけを
// 抽出しitemsの先頭に追加する。全置換しないため、下にスクロールして古い投稿を
// 見ている間でも選択中indexがずれない(新着件数分を加算するだけで位置を維持できる)。
export function mergeNewTimelineItems(
  items: TimelineItem[],
  index: number,
  newPageItems: TimelineItem[],
  seenUris: Set<string>,
  seenRootUris?: Set<string>,
): { items: TimelineItem[]; index: number } {
  const newItems = dedupeTimelineItems(newPageItems, seenUris, seenRootUris)
  if (newItems.length === 0) return { items, index }
  return { items: [...newItems, ...items], index: index + newItems.length }
}

const GROUPABLE_NOTIFICATION_REASONS: NotificationItem['reason'][] = ['like', 'repost', 'follow']

// Bluesky公式Web版(bluesky-social/social-app)のgroupNotificationsを参考にした簡易版。
// 同じ対象(reasonSubjectUri)への同種の反応(like/repost/follow)を1件にまとめ、
// 「〇〇および他n人が...」という表示を可能にする。公式と異なり時間窓(48時間以内)は設けない
// (通知リストは基本的に新しい順であり、実用上問題にならないため)。
export function groupNotificationItems(items: NotificationItem[]): NotificationItem[] {
  const grouped: NotificationItem[] = []
  for (const item of items) {
    if (GROUPABLE_NOTIFICATION_REASONS.includes(item.reason)) {
      const existing = grouped.find(
        (g) => g.reason === item.reason && g.reasonSubjectUri === item.reasonSubjectUri && g.author.did !== item.author.did,
      )
      if (existing) {
        existing.additionalAuthors = [...(existing.additionalAuthors ?? []), item.author]
        existing.isRead = existing.isRead && item.isRead
        continue
      }
    }
    grouped.push({ ...item })
  }
  return grouped
}

export async function fetchNotifications(client: AtpClient, cursor?: string): Promise<Page<NotificationItem>> {
  const res = await client.listNotifications({ cursor, limit: PAGE_SIZE })
  const items = groupNotificationItems(res.data.notifications.map((n) => toNotificationItem(n as never)))

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
  quote?: { uri: string; cid: string },
) {
  return client.post({ text, reply, embed: quote ? { $type: 'app.bsky.embed.record', record: quote } : undefined })
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

export async function toggleFollow(
  client: AtpClient,
  targetDid: string,
  followingUri: string | undefined,
): Promise<{ followingUri?: string }> {
  if (followingUri) {
    await client.deleteFollow(followingUri)
    return { followingUri: undefined }
  }
  const { uri } = await client.follow(targetDid)
  return { followingUri: uri }
}

export async function toggleMute(client: AtpClient, targetDid: string, muted: boolean): Promise<{ muted: boolean }> {
  if (muted) {
    await client.unmute(targetDid)
    return { muted: false }
  }
  await client.mute(targetDid)
  return { muted: true }
}

const BLOCK_COLLECTION = 'app.bsky.graph.block'

export async function toggleBlock(
  client: AtpClient,
  targetDid: string,
  blockingUri: string | undefined,
): Promise<{ blockingUri?: string }> {
  if (blockingUri) {
    const rkey = blockingUri.split('/').pop()!
    await client.com.atproto.repo.deleteRecord({ repo: client.did!, collection: BLOCK_COLLECTION, rkey })
    return { blockingUri: undefined }
  }
  const { data } = await client.com.atproto.repo.createRecord({
    repo: client.did!,
    collection: BLOCK_COLLECTION,
    record: { $type: BLOCK_COLLECTION, subject: targetDid, createdAt: new Date().toISOString() },
  })
  return { blockingUri: data.uri }
}
