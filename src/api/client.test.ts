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
} from './client.js'
import type { AtpClient } from './atp-client.js'
import type { PostSummary, TimelineItem } from './types.js'

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
  return { post: { ...(likedPost as PostSummary), uri } }
}

describe('dedupeTimelineItems', () => {
  it('同じuriの投稿が複数あれば最初の1件だけ残す', () => {
    const items = [makeItem('at://p/b'), makeItem('at://p/d'), makeItem('at://p/a'), makeItem('at://p/b'), makeItem('at://p/c')]
    const result = dedupeTimelineItems(items)
    expect(result.map((it) => it.post.uri)).toEqual(['at://p/b', 'at://p/d', 'at://p/a', 'at://p/c'])
  })

  it('重複が無ければそのまま返す', () => {
    const items = [makeItem('at://p/a'), makeItem('at://p/b')]
    expect(dedupeTimelineItems(items)).toEqual(items)
  })
})
