import { describe, expect, it, vi } from 'vitest'
import {
  fetchTimeline,
  fetchAuthorFeed,
  fetchNotifications,
  fetchUnreadCount,
  searchPostsPage,
  createPost,
  toggleLike,
  toggleRepost,
  deletePost,
  dedupeTimelineItems,
  groupNotificationItems,
} from './client.js'
import { toTimelineItems } from './format.js'
import type { AtpClient } from './atp-client.js'
import type { NotificationItem, PostSummary, TimelineItem } from './types.js'

const author = { did: 'did:plc:1', handle: 'a.bsky.social' }
const rawPost = {
  uri: 'at://p/1',
  cid: 'c1',
  author,
  record: { text: 'hi', createdAt: '2026-08-01T00:00:00.000Z' },
  replyCount: 0,
  repostCount: 0,
  likeCount: 0,
}

function fakeClient(overrides: Partial<AtpClient> = {}): AtpClient {
  return {
    getTimeline: vi.fn(async () => ({ data: { cursor: 'c2', feed: [{ post: rawPost }] } })) as never,
    getAuthorFeed: vi.fn(async () => ({ data: { cursor: 'c3', feed: [{ post: rawPost }] } })) as never,
    getPostThread: vi.fn() as never,
    getPosts: vi.fn(async () => ({ data: { posts: [] } })) as never,
    post: vi.fn(async () => ({ uri: 'at://new/1', cid: 'cnew' })),
    like: vi.fn(async () => ({ uri: 'at://like/1' })),
    deleteLike: vi.fn(async () => undefined),
    repost: vi.fn(async () => ({ uri: 'at://repost/1' })),
    deleteRepost: vi.fn(async () => undefined),
    deletePost: vi.fn(async () => undefined),
    getProfile: vi.fn() as never,
    listNotifications: vi.fn(async () => ({ data: { cursor: undefined, notifications: [] } })) as never,
    updateSeenNotifications: vi.fn(async () => undefined),
    countUnreadNotifications: vi.fn(async () => ({ data: { count: 0 } })) as never,
    app: { bsky: { feed: { searchPosts: vi.fn(async () => ({ data: { cursor: undefined, posts: [rawPost] } })) as never } } },
    ...overrides,
  } as AtpClient
}

describe('fetchTimeline', () => {
  it('feedをTimelineItemに変換しcursorを返す', async () => {
    const client = fakeClient()
    const page = await fetchTimeline(client)
    expect(page.cursor).toBe('c2')
    expect(page.items[0].post.text).toBe('hi')
  })
})

describe('fetchAuthorFeed', () => {
  it('actorを渡してfeedをTimelineItemに変換しcursorを返す', async () => {
    const client = fakeClient()
    const page = await fetchAuthorFeed(client, 'did:plc:target')
    expect(client.getAuthorFeed).toHaveBeenCalledWith({ actor: 'did:plc:target', cursor: undefined, limit: 30 })
    expect(page.cursor).toBe('c3')
    expect(page.items[0].post.text).toBe('hi')
  })
})

describe('fetchNotifications', () => {
  it('空配列でも正しく返す', async () => {
    const page = await fetchNotifications(fakeClient())
    expect(page.items).toEqual([])
  })

  it('like/repost通知はreasonSubjectの投稿をsubjectPostとして取得する', async () => {
    const notifications = [
      { uri: 'at://n/1', author, reason: 'like', reasonSubject: 'at://p/liked', isRead: false, indexedAt: '2026-08-01T00:00:00.000Z' },
      { uri: 'at://n/2', author, reason: 'repost', reasonSubject: 'at://p/reposted', isRead: false, indexedAt: '2026-08-01T00:00:00.000Z' },
    ]
    const getPosts = vi.fn(async ({ uris }: { uris: string[] }) => ({
      data: { posts: uris.map((uri) => ({ ...rawPost, uri, record: { text: `text of ${uri}`, createdAt: rawPost.record.createdAt } })) },
    }))
    const client = fakeClient({
      listNotifications: vi.fn(async () => ({ data: { cursor: undefined, notifications } })) as never,
      getPosts: getPosts as never,
    })
    const page = await fetchNotifications(client)
    expect(getPosts).toHaveBeenCalledWith({ uris: ['at://p/liked', 'at://p/reposted'] })
    expect(page.items[0].subjectPost?.text).toBe('text of at://p/liked')
    expect(page.items[1].subjectPost?.text).toBe('text of at://p/reposted')
  })

  it('quote通知は通知自体のuriの投稿をsubjectPostとして取得する', async () => {
    const notifications = [
      { uri: 'at://n/quote1', author, reason: 'quote', isRead: false, indexedAt: '2026-08-01T00:00:00.000Z' },
    ]
    const getPosts = vi.fn(async ({ uris }: { uris: string[] }) => ({
      data: { posts: uris.map((uri) => ({ ...rawPost, uri, record: { text: `quoted text`, createdAt: rawPost.record.createdAt } })) },
    }))
    const client = fakeClient({
      listNotifications: vi.fn(async () => ({ data: { cursor: undefined, notifications } })) as never,
      getPosts: getPosts as never,
    })
    const page = await fetchNotifications(client)
    expect(getPosts).toHaveBeenCalledWith({ uris: ['at://n/quote1'] })
    expect(page.items[0].subjectPost?.text).toBe('quoted text')
  })

  it('reply通知は通知自体のuriの投稿をsubjectPostとして取得する', async () => {
    const notifications = [
      { uri: 'at://n/reply1', author, reason: 'reply', isRead: false, indexedAt: '2026-08-01T00:00:00.000Z' },
    ]
    const getPosts = vi.fn(async ({ uris }: { uris: string[] }) => ({
      data: { posts: uris.map((uri) => ({ ...rawPost, uri, record: { text: `reply text`, createdAt: rawPost.record.createdAt } })) },
    }))
    const client = fakeClient({
      listNotifications: vi.fn(async () => ({ data: { cursor: undefined, notifications } })) as never,
      getPosts: getPosts as never,
    })
    const page = await fetchNotifications(client)
    expect(getPosts).toHaveBeenCalledWith({ uris: ['at://n/reply1'] })
    expect(page.items[0].subjectPost?.text).toBe('reply text')
  })

  it('reply通知は返信先(reasonSubject)投稿の著者ハンドルをreplyToHandleとして取得する', async () => {
    const notifications = [
      { uri: 'at://n/reply1', author, reason: 'reply', reasonSubject: 'at://p/parent1', isRead: false, indexedAt: '2026-08-01T00:00:00.000Z' },
    ]
    const getPosts = vi.fn(async ({ uris }: { uris: string[] }) => ({
      data: {
        posts: uris.map((uri) =>
          uri === 'at://p/parent1'
            ? { ...rawPost, uri, author: { ...author, handle: 'parent-author.bsky.social' }, record: { text: 'parent text', createdAt: rawPost.record.createdAt } }
            : { ...rawPost, uri, record: { text: 'reply text', createdAt: rawPost.record.createdAt } },
        ),
      },
    }))
    const client = fakeClient({
      listNotifications: vi.fn(async () => ({ data: { cursor: undefined, notifications } })) as never,
      getPosts: getPosts as never,
    })
    const page = await fetchNotifications(client)
    expect(getPosts).toHaveBeenCalledWith({ uris: ['at://n/reply1', 'at://p/parent1'] })
    expect(page.items[0].replyToHandle).toBe('parent-author.bsky.social')
    expect(page.items[0].subjectPost?.text).toBe('reply text')
  })

  it.each(['like', 'repost'] as const)('%s通知の対象投稿が削除済み(getPostsの結果に無い)場合、その通知は除外される', async (reason) => {
    const notifications = [
      { uri: 'at://n/1', author, reason, reasonSubject: 'at://p/deleted', isRead: false, indexedAt: '2026-08-01T00:00:00.000Z' },
      { uri: 'at://n/2', author, reason, reasonSubject: 'at://p/exists', isRead: false, indexedAt: '2026-08-01T00:00:00.000Z' },
    ]
    const getPosts = vi.fn(async () => ({
      data: { posts: [{ ...rawPost, uri: 'at://p/exists', record: { text: 'still here', createdAt: rawPost.record.createdAt } }] },
    }))
    const client = fakeClient({
      listNotifications: vi.fn(async () => ({ data: { cursor: undefined, notifications } })) as never,
      getPosts: getPosts as never,
    })
    const page = await fetchNotifications(client)
    expect(page.items).toHaveLength(1)
    expect(page.items[0].uri).toBe('at://n/2')
  })

  it('follow通知は対象投稿が無いのでgetPostsを呼ばない', async () => {
    const notifications = [{ uri: 'at://n/f1', author, reason: 'follow', isRead: false, indexedAt: '2026-08-01T00:00:00.000Z' }]
    const getPosts = vi.fn(async () => ({ data: { posts: [] } }))
    const client = fakeClient({
      listNotifications: vi.fn(async () => ({ data: { cursor: undefined, notifications } })) as never,
      getPosts: getPosts as never,
    })
    await fetchNotifications(client)
    expect(getPosts).not.toHaveBeenCalled()
  })

  it('getPostsが失敗しても通知一覧自体はsubjectPost無しで返す', async () => {
    const notifications = [
      { uri: 'at://n/1', author, reason: 'like', reasonSubject: 'at://p/liked', isRead: false, indexedAt: '2026-08-01T00:00:00.000Z' },
    ]
    const client = fakeClient({
      listNotifications: vi.fn(async () => ({ data: { cursor: undefined, notifications } })) as never,
      getPosts: vi.fn(async () => {
        throw new Error('network error')
      }) as never,
    })
    const page = await fetchNotifications(client)
    expect(page.items[0].subjectPost).toBeUndefined()
  })
})

describe('fetchUnreadCount', () => {
  it('countをそのまま返す', async () => {
    const client = fakeClient({
      countUnreadNotifications: vi.fn(async () => ({ data: { count: 3 } })) as never,
    })
    const count = await fetchUnreadCount(client)
    expect(count).toBe(3)
  })

  it('0件ならば0を返す', async () => {
    const client = fakeClient()
    const count = await fetchUnreadCount(client)
    expect(count).toBe(0)
  })
})

describe('searchPostsPage', () => {
  it('検索結果をPostSummaryに変換する', async () => {
    const page = await searchPostsPage(fakeClient(), 'query')
    expect(page.items[0].text).toBe('hi')
  })
})

describe('createPost', () => {
  it('textとreplyを渡してpostを呼ぶ', async () => {
    const client = fakeClient()
    await createPost(client, 'hello', { root: { uri: 'r', cid: 'rc' }, parent: { uri: 'p', cid: 'pc' } })
    expect(client.post).toHaveBeenCalledWith({
      text: 'hello',
      reply: { root: { uri: 'r', cid: 'rc' }, parent: { uri: 'p', cid: 'pc' } },
    })
  })
})

const likedPost: PostSummary = {
  uri: 'at://p/1',
  cid: 'c1',
  author: { did: 'did:plc:1', handle: 'a.bsky.social' },
  text: 'hi',
  createdAt: '2026-08-01T00:00:00.000Z',
  images: [],
  hasVideo: false,
  replyCount: 0,
  repostCount: 0,
  likeCount: 5,
  viewerLikeUri: 'at://like/existing',
}

describe('toggleLike', () => {
  it('既にいいね済みならdeleteLikeしてカウントを減らす', async () => {
    const client = fakeClient()
    const result = await toggleLike(client, likedPost)
    expect(client.deleteLike).toHaveBeenCalledWith('at://like/existing')
    expect(result).toEqual({ viewerLikeUri: undefined, likeCount: 4 })
  })

  it('未いいねならlikeしてカウントを増やす', async () => {
    const client = fakeClient()
    const result = await toggleLike(client, { ...likedPost, viewerLikeUri: undefined, likeCount: 0 })
    expect(client.like).toHaveBeenCalledWith('at://p/1', 'c1')
    expect(result).toEqual({ viewerLikeUri: 'at://like/1', likeCount: 1 })
  })
})

describe('toggleRepost', () => {
  it('既にリポスト済みならdeleteRepostしてカウントを減らす', async () => {
    const client = fakeClient()
    const result = await toggleRepost(client, { ...likedPost, viewerRepostUri: 'at://repost/existing', repostCount: 2 })
    expect(client.deleteRepost).toHaveBeenCalledWith('at://repost/existing')
    expect(result).toEqual({ viewerRepostUri: undefined, repostCount: 1 })
  })
})

describe('deletePost', () => {
  it('post.uriを渡してclient.deletePostを呼ぶ', async () => {
    const client = fakeClient()
    await deletePost(client, likedPost)
    expect(client.deletePost).toHaveBeenCalledWith('at://p/1')
  })
})

function makeItem(uri: string): TimelineItem {
  return { post: { ...(likedPost as PostSummary), uri }, sliceKey: uri, rootUri: uri }
}

function makePost(uri: string): TimelineItem['post'] {
  return { ...(likedPost as PostSummary), uri }
}

describe('dedupeTimelineItems', () => {
  it('異なるスライス(例: 複数人による別々のリポスト)が同じ投稿uriを本体として含む場合、最初の1件だけ残す', () => {
    const items: TimelineItem[] = [
      { post: makePost('at://p/b'), sliceKey: 'repost-1', rootUri: 'at://p/b' },
      { post: makePost('at://p/d'), sliceKey: 'slice-d', rootUri: 'at://p/d' },
      { post: makePost('at://p/a'), sliceKey: 'slice-a', rootUri: 'at://p/a' },
      { post: makePost('at://p/b'), sliceKey: 'repost-2', rootUri: 'at://p/b' },
      { post: makePost('at://p/c'), sliceKey: 'slice-c', rootUri: 'at://p/c' },
    ]
    const result = dedupeTimelineItems(items)
    expect(result.map((it) => it.post.uri)).toEqual(['at://p/b', 'at://p/d', 'at://p/a', 'at://p/c'])
  })

  it('重複が無ければそのまま返す', () => {
    const items = [makeItem('at://p/a'), makeItem('at://p/b')]
    expect(dedupeTimelineItems(items)).toEqual(items)
  })

  it('公式実装のコメント例[A→B→C],[A→D→E],[A→D→F] → [A→B→C],[D→E],[F]をそのまま再現する', () => {
    const a = makePost('at://p/a')
    const b = makePost('at://p/b')
    const c = makePost('at://p/c')
    const d = makePost('at://p/d')
    const e = makePost('at://p/e')
    const f = makePost('at://p/f')
    const items: TimelineItem[] = [
      { post: a, connectsToNext: true, sliceKey: 'slice1', rootUri: 'at://p/a' },
      { post: b, connectsToNext: true, sliceKey: 'slice1', rootUri: 'at://p/a' },
      { post: c, sliceKey: 'slice1', rootUri: 'at://p/a' },
      { post: a, connectsToNext: true, sliceKey: 'slice2', rootUri: 'at://p/a' },
      { post: d, connectsToNext: true, sliceKey: 'slice2', rootUri: 'at://p/a' },
      { post: e, sliceKey: 'slice2', rootUri: 'at://p/a' },
      { post: a, connectsToNext: true, sliceKey: 'slice3', rootUri: 'at://p/a' },
      { post: d, connectsToNext: true, sliceKey: 'slice3', rootUri: 'at://p/a' },
      { post: f, sliceKey: 'slice3', rootUri: 'at://p/a' },
    ]
    const result = dedupeTimelineItems(items)
    expect(result.map((it) => it.post.uri)).toEqual(['at://p/a', 'at://p/b', 'at://p/c', 'at://p/d', 'at://p/e', 'at://p/f'])
  })

  it('スライスの先頭(root)が既知なら、そのアイテムだけ剥がして残りは表示する', () => {
    const a = makePost('at://p/a')
    const b = makePost('at://p/b')
    const c = makePost('at://p/c')
    const items: TimelineItem[] = [
      { post: a, sliceKey: 'slice1', rootUri: 'at://p/a' },
      { post: a, connectsToNext: true, sliceKey: 'slice2', rootUri: 'at://p/a' },
      { post: b, connectsToNext: true, sliceKey: 'slice2', rootUri: 'at://p/a' },
      { post: c, sliceKey: 'slice2', rootUri: 'at://p/a' },
    ]
    const result = dedupeTimelineItems(items)
    // Aは既に表示済みなので、2番目のスライスからはAが剥がれてB,Cだけが残る
    expect(result.map((it) => it.post.uri)).toEqual(['at://p/a', 'at://p/b', 'at://p/c'])
  })

  it('スライスの最後(本体)が既知なら、スライス全体を破棄する(自己リプライ連鎖でBが単独浮遊表示されるバグの再現・修正確認)', () => {
    // A(root)←B(Aへの返信)←C(Bへの返信)←D(Cへの返信) という4段の自己リプライ連鎖。
    // フィードは新しい順で流れてくるため、D→C→B→Aのフィードエントリ順にitemsが並ぶ。
    const a = makePost('at://p/a')
    const b = makePost('at://p/b')
    const c = makePost('at://p/c')
    const d = makePost('at://p/d')
    const items: TimelineItem[] = [
      // Dのフィードエントリ: root=A, parent=C(root!==parent)
      { post: a, connectsToNext: true, isThreadRoot: true, sliceKey: 'd', rootUri: 'at://p/a' },
      { post: c, connectsToNext: true, sliceKey: 'd', rootUri: 'at://p/a' },
      { post: d, replyToHandle: 'author-of-c', sliceKey: 'd', rootUri: 'at://p/a' },
      // Cのフィードエントリ: root=A, parent=B(root!==parent)
      { post: a, connectsToNext: true, isThreadRoot: true, sliceKey: 'c', rootUri: 'at://p/a' },
      { post: b, connectsToNext: true, sliceKey: 'c', rootUri: 'at://p/a' },
      { post: c, replyToHandle: 'author-of-b', sliceKey: 'c', rootUri: 'at://p/a' },
      // Bのフィードエントリ: root=A, parent=A(同一)
      { post: a, connectsToNext: true, sliceKey: 'b', rootUri: 'at://p/a' },
      { post: b, replyToHandle: 'author-of-a', sliceKey: 'b', rootUri: 'at://p/a' },
      // Aのフィードエントリ(reply無し)
      { post: a, sliceKey: 'a', rootUri: 'at://p/a' },
    ]
    const result = dedupeTimelineItems(items)
    // Dのスライス[A,C,D]がそのまま表示される。Cのスライス[A,B,C]はA,Cが既知なので
    // 先頭Aが剥がれ[B,C]になるが、最後のCも既知なのでスライス全体が破棄される(Bも表示されない)。
    // Bのスライス[A,B]も同様にAが剥がれ[B]になるが、Bは既にCのスライス破棄時にseenUris扱いにならないため
    // 実際には表示されうる。以降のAのスライスはAが既知なので破棄される。
    expect(result.map((it) => it.post.uri)).toEqual(['at://p/a', 'at://p/c', 'at://p/d'])
    // Bが離れた位置に単独浮遊表示されることはない(今回のバグの再発防止)
    expect(result.some((it) => it.post.uri === 'at://p/b')).toBe(false)
  })

  it('seenUrisを呼び出し間で永続化すると、ページをまたいでスライスが破棄された投稿(X)が後続ページで単独浮遊表示されない', () => {
    // 実際に発生したケース(A→X→B→C、4段連鎖)を再現。
    // ページ1にfeed(C)とfeed(B)、ページ2にfeed(X)とfeed(A)が含まれる状況を想定。
    const a = makePost('at://p/a')
    const b = makePost('at://p/b')
    const c = makePost('at://p/c')
    const x = makePost('at://p/x')
    const page1: TimelineItem[] = [
      // feed(C): root=A, parent=B(root!==parent)
      { post: a, connectsToNext: true, isThreadRoot: true, sliceKey: 'c', rootUri: 'at://p/a' },
      { post: b, connectsToNext: true, sliceKey: 'c', rootUri: 'at://p/a' },
      { post: c, replyToHandle: 'author-of-b', sliceKey: 'c', rootUri: 'at://p/a' },
      // feed(B): root=A, parent=X(root!==parent)
      { post: a, connectsToNext: true, isThreadRoot: true, sliceKey: 'b', rootUri: 'at://p/a' },
      { post: x, connectsToNext: true, sliceKey: 'b', rootUri: 'at://p/a' },
      { post: b, replyToHandle: 'author-of-x', sliceKey: 'b', rootUri: 'at://p/a' },
    ]
    const page2: TimelineItem[] = [
      // feed(X): root=A, parent=A(同一)
      { post: a, connectsToNext: true, sliceKey: 'x', rootUri: 'at://p/a' },
      { post: x, replyToHandle: 'author-of-a', sliceKey: 'x', rootUri: 'at://p/a' },
      // feed(A)(reply無し)
      { post: a, sliceKey: 'a', rootUri: 'at://p/a' },
    ]

    const seenUris = new Set<string>()
    const result1 = dedupeTimelineItems(page1, seenUris)
    const result2 = dedupeTimelineItems(page2, seenUris)
    const combined = [...result1, ...result2]

    expect(combined.map((it) => it.post.uri)).toEqual(['at://p/a', 'at://p/b', 'at://p/c'])
    // Xがページをまたいで単独浮遊表示されることはない
    expect(combined.some((it) => it.post.uri === 'at://p/x')).toBe(false)
  })

  it('(退行確認) seenUrisを永続化せず毎回新規に呼ぶと、ページをまたいだ投稿(X)が単独浮遊表示されてしまう', () => {
    const a = makePost('at://p/a')
    const b = makePost('at://p/b')
    const c = makePost('at://p/c')
    const x = makePost('at://p/x')
    const page1: TimelineItem[] = [
      { post: a, connectsToNext: true, isThreadRoot: true, sliceKey: 'c', rootUri: 'at://p/a' },
      { post: b, connectsToNext: true, sliceKey: 'c', rootUri: 'at://p/a' },
      { post: c, replyToHandle: 'author-of-b', sliceKey: 'c', rootUri: 'at://p/a' },
      { post: a, connectsToNext: true, isThreadRoot: true, sliceKey: 'b', rootUri: 'at://p/a' },
      { post: x, connectsToNext: true, sliceKey: 'b', rootUri: 'at://p/a' },
      { post: b, replyToHandle: 'author-of-x', sliceKey: 'b', rootUri: 'at://p/a' },
    ]
    const page2: TimelineItem[] = [
      { post: a, connectsToNext: true, sliceKey: 'x', rootUri: 'at://p/a' },
      { post: x, replyToHandle: 'author-of-a', sliceKey: 'x', rootUri: 'at://p/a' },
      { post: a, sliceKey: 'a', rootUri: 'at://p/a' },
    ]

    // TimelineScreenの旧実装(setItems((prev) => dedupeTimelineItems([...prev, ...page.items])))を模して、
    // prev(既にdedupe済みの結果)とpage2を結合してから再度dedupeし直すとどうなるか
    const prev = dedupeTimelineItems(page1)
    const merged = dedupeTimelineItems([...prev, ...page2])

    // Xが単独浮遊表示されてしまう(これが今回発見されたバグの再現)
    expect(merged.some((it) => it.post.uri === 'at://p/x')).toBe(true)
  })

  it('seenRootUrisを渡すと、同じスレッド(rootUri)から2件目以降のスライスはpost単位判定に進む前に丸ごと破棄される(公式実装のdedupThreads相当)', () => {
    // 実際に発生したケース: A(root)←X←B←C という4段の自己リプライ連鎖。
    // Cのスライス([A,B,C])が最初に表示された時点でrootUri=Aがseenになり、
    // 以降Aと同じスレッドのX単独のスライス([A,X])もpost単位のseenUris判定に進む前に破棄される。
    const a = makePost('at://p/a')
    const b = makePost('at://p/b')
    const c = makePost('at://p/c')
    const x = makePost('at://p/x')
    const items: TimelineItem[] = [
      // feed(C): root=A, parent=B(root!==parent)
      { post: a, connectsToNext: true, isThreadRoot: true, sliceKey: 'c', rootUri: 'at://p/a' },
      { post: b, connectsToNext: true, sliceKey: 'c', rootUri: 'at://p/a' },
      { post: c, replyToHandle: 'author-of-b', sliceKey: 'c', rootUri: 'at://p/a' },
      // feed(X): root=A, parent=A(同一)。C由来のスライスとは別に、Xが単独で流れてくる想定
      { post: a, connectsToNext: true, sliceKey: 'x', rootUri: 'at://p/a' },
      { post: x, replyToHandle: 'author-of-a', sliceKey: 'x', rootUri: 'at://p/a' },
      // feed(A)(reply無し)
      { post: a, sliceKey: 'a', rootUri: 'at://p/a' },
    ]
    const seenRootUris = new Set<string>()
    const result = dedupeTimelineItems(items, new Set(), seenRootUris)

    expect(result.map((it) => it.post.uri)).toEqual(['at://p/a', 'at://p/b', 'at://p/c'])
    // Xはスレッド単位のdedupeで完全に非表示になる(post単位のreplyToHandleが付いていても関係ない)
    expect(result.some((it) => it.post.uri === 'at://p/x')).toBe(false)
    expect(seenRootUris.has('at://p/a')).toBe(true)
  })

  it('seenRootUrisを渡しても、リポストのスライスはスレッド単位dedupeの対象外(常に表示される)', () => {
    const a = makePost('at://p/a')
    const c = makePost('at://p/c')
    const items: TimelineItem[] = [
      { post: c, sliceKey: 'c', rootUri: 'at://p/a' },
      // 同じrootUri(=a)を持つ別スレッドの投稿だが、これはリポストなのでスレッド単位dedupeの対象外
      { post: a, repostedBy: { did: 'did:plc:x', handle: 'reposter.bsky.social' }, sliceKey: 'a-repost', rootUri: 'at://p/a' },
    ]
    const result = dedupeTimelineItems(items, new Set(), new Set())
    expect(result.map((it) => it.post.uri)).toEqual(['at://p/c', 'at://p/a'])
  })

  it('seenRootUrisを渡さなければ、従来通りpost単位のdedupeのみが行われる(著者フィード等での後方互換)', () => {
    const a = makePost('at://p/a')
    const b = makePost('at://p/b')
    const c = makePost('at://p/c')
    const x = makePost('at://p/x')
    const items: TimelineItem[] = [
      { post: a, connectsToNext: true, isThreadRoot: true, sliceKey: 'c', rootUri: 'at://p/a' },
      { post: b, connectsToNext: true, sliceKey: 'c', rootUri: 'at://p/a' },
      { post: c, replyToHandle: 'author-of-b', sliceKey: 'c', rootUri: 'at://p/a' },
      { post: a, connectsToNext: true, sliceKey: 'x', rootUri: 'at://p/a' },
      { post: x, replyToHandle: 'author-of-a', sliceKey: 'x', rootUri: 'at://p/a' },
    ]
    const result = dedupeTimelineItems(items)
    // seenRootUris省略時は、Xの本体は「先頭Aだけ剥がされ、Xは初見なのでそのまま表示される」という
    // post単位dedupeの挙動になる(著者フィードでは全投稿を見せたいため、スレッド単位dedupeは行わない)
    expect(result.map((it) => it.post.uri)).toEqual(['at://p/a', 'at://p/b', 'at://p/c', 'at://p/x'])
  })

  it('(統合) 同じ投稿が複数人にリポストされてタイムラインに流れてきても、toTimelineItems→dedupeTimelineItemsを通すと1件だけ表示される', () => {
    const target = { ...rawPost, uri: 'at://p/target' }
    const reposterA = { did: 'did:plc:reposter-a', handle: 'a.bsky.social' }
    const reposterB = { did: 'did:plc:reposter-b', handle: 'b.bsky.social' }
    const feedFromA = toTimelineItems({
      post: target,
      reason: { $type: 'app.bsky.feed.defs#reasonRepost', by: reposterA, indexedAt: '2026-08-01T00:00:02.000Z' },
    } as never)
    const feedFromB = toTimelineItems({
      post: target,
      reason: { $type: 'app.bsky.feed.defs#reasonRepost', by: reposterB, indexedAt: '2026-08-01T00:00:03.000Z' },
    } as never)

    const merged = [...feedFromB, ...feedFromA] // フィードは新しい順(Bのリポストが後、つまり新しい)なので先に来る
    const result = dedupeTimelineItems(merged, new Set(), new Set())

    expect(result).toHaveLength(1)
    expect(result[0]?.post.uri).toBe('at://p/target')
    // 先に流れてきた(=より新しい)Bのリポストの表記が残る
    expect(result[0]?.repostedBy?.handle).toBe('b.bsky.social')
  })
})

function makeNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    uri: 'at://n/1',
    author: { did: 'did:plc:default', handle: 'default.bsky.social' },
    reason: 'like',
    reasonSubjectUri: 'at://p/target',
    isRead: true,
    indexedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('groupNotificationItems', () => {
  it('同じreason・同じreasonSubjectUri・異なる著者のlike通知は1件にグルーピングされる', () => {
    const items: NotificationItem[] = [
      makeNotification({ uri: 'at://n/1', author: { did: 'did:plc:a', handle: 'a.bsky.social' } }),
      makeNotification({ uri: 'at://n/2', author: { did: 'did:plc:b', handle: 'b.bsky.social' } }),
    ]
    const result = groupNotificationItems(items)
    expect(result).toHaveLength(1)
    expect(result[0]?.author.handle).toBe('a.bsky.social')
    expect(result[0]?.additionalAuthors?.map((a) => a.handle)).toEqual(['b.bsky.social'])
  })

  it('3人以上のlikeは全員additionalAuthorsに積み上がる', () => {
    const items: NotificationItem[] = [
      makeNotification({ uri: 'at://n/1', author: { did: 'did:plc:a', handle: 'a.bsky.social' } }),
      makeNotification({ uri: 'at://n/2', author: { did: 'did:plc:b', handle: 'b.bsky.social' } }),
      makeNotification({ uri: 'at://n/3', author: { did: 'did:plc:c', handle: 'c.bsky.social' } }),
    ]
    const result = groupNotificationItems(items)
    expect(result).toHaveLength(1)
    expect(result[0]?.additionalAuthors?.map((a) => a.handle)).toEqual(['b.bsky.social', 'c.bsky.social'])
  })

  it('reasonSubjectUriが異なれば別グループのまま', () => {
    const items: NotificationItem[] = [
      makeNotification({ uri: 'at://n/1', reasonSubjectUri: 'at://p/1', author: { did: 'did:plc:a', handle: 'a.bsky.social' } }),
      makeNotification({ uri: 'at://n/2', reasonSubjectUri: 'at://p/2', author: { did: 'did:plc:b', handle: 'b.bsky.social' } }),
    ]
    const result = groupNotificationItems(items)
    expect(result).toHaveLength(2)
  })

  it('reasonが異なれば(like と repost)別グループのまま', () => {
    const items: NotificationItem[] = [
      makeNotification({ uri: 'at://n/1', reason: 'like', author: { did: 'did:plc:a', handle: 'a.bsky.social' } }),
      makeNotification({ uri: 'at://n/2', reason: 'repost', author: { did: 'did:plc:b', handle: 'b.bsky.social' } }),
    ]
    const result = groupNotificationItems(items)
    expect(result).toHaveLength(2)
  })

  it('reply/mention/quote/otherはグルーピング対象外(常に個別のまま)', () => {
    const items: NotificationItem[] = [
      makeNotification({ uri: 'at://n/1', reason: 'reply', reasonSubjectUri: 'at://p/1', author: { did: 'did:plc:a', handle: 'a.bsky.social' } }),
      makeNotification({ uri: 'at://n/2', reason: 'reply', reasonSubjectUri: 'at://p/1', author: { did: 'did:plc:b', handle: 'b.bsky.social' } }),
    ]
    const result = groupNotificationItems(items)
    expect(result).toHaveLength(2)
  })

  it('followはreasonSubjectUriが無くても、reasonが同じなら正しくグルーピングされる', () => {
    const items: NotificationItem[] = [
      makeNotification({ uri: 'at://n/1', reason: 'follow', reasonSubjectUri: undefined, author: { did: 'did:plc:a', handle: 'a.bsky.social' } }),
      makeNotification({ uri: 'at://n/2', reason: 'follow', reasonSubjectUri: undefined, author: { did: 'did:plc:b', handle: 'b.bsky.social' } }),
    ]
    const result = groupNotificationItems(items)
    expect(result).toHaveLength(1)
    expect(result[0]?.additionalAuthors?.map((a) => a.handle)).toEqual(['b.bsky.social'])
  })

  it('グループ内のいずれかが未読なら、グループ全体が未読扱いになる', () => {
    const items: NotificationItem[] = [
      makeNotification({ uri: 'at://n/1', isRead: true, author: { did: 'did:plc:a', handle: 'a.bsky.social' } }),
      makeNotification({ uri: 'at://n/2', isRead: false, author: { did: 'did:plc:b', handle: 'b.bsky.social' } }),
    ]
    const result = groupNotificationItems(items)
    expect(result[0]?.isRead).toBe(false)
  })

  it('全部既読なら、グループも既読のまま', () => {
    const items: NotificationItem[] = [
      makeNotification({ uri: 'at://n/1', isRead: true, author: { did: 'did:plc:a', handle: 'a.bsky.social' } }),
      makeNotification({ uri: 'at://n/2', isRead: true, author: { did: 'did:plc:b', handle: 'b.bsky.social' } }),
    ]
    const result = groupNotificationItems(items)
    expect(result[0]?.isRead).toBe(true)
  })

  it('離れた位置にある通知同士でも(間に他の通知が挟まっても)同条件ならグルーピングされる', () => {
    const items: NotificationItem[] = [
      makeNotification({ uri: 'at://n/1', author: { did: 'did:plc:a', handle: 'a.bsky.social' } }),
      makeNotification({ uri: 'at://n/mid', reason: 'follow', reasonSubjectUri: undefined, author: { did: 'did:plc:z', handle: 'z.bsky.social' } }),
      makeNotification({ uri: 'at://n/2', author: { did: 'did:plc:b', handle: 'b.bsky.social' } }),
    ]
    const result = groupNotificationItems(items)
    expect(result).toHaveLength(2)
    expect(result[0]?.additionalAuthors?.map((a) => a.handle)).toEqual(['b.bsky.social'])
  })
})
