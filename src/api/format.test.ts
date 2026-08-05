import { describe, expect, it } from 'vitest'
import { toAuthor, toPostSummary, toTimelineItems, toNotificationItem, formatRelativeTime, postWebUrl } from './format.js'

const rawAuthor = {
  did: 'did:plc:abc',
  handle: 'alice.bsky.social',
  displayName: 'Alice',
  avatar: 'https://example.com/avatar.jpg',
}

describe('toAuthor', () => {
  it('avatarをavatarUrlにマップする', () => {
    expect(toAuthor(rawAuthor)).toEqual({
      did: 'did:plc:abc',
      handle: 'alice.bsky.social',
      displayName: 'Alice',
      avatarUrl: 'https://example.com/avatar.jpg@jpeg',
    })
  })

  it('拡張子サフィックスの無いCDN画像URLには@jpegを付与する', () => {
    const raw = {
      did: 'did:plc:abc',
      handle: 'alice.bsky.social',
      avatar: 'https://cdn.bsky.app/img/avatar/plain/xxx/yyy',
    }
    expect(toAuthor(raw).avatarUrl).toBe('https://cdn.bsky.app/img/avatar/plain/xxx/yyy@jpeg')
  })

  it('avatarがundefinedの場合はavatarUrlもundefinedのまま', () => {
    const raw = { did: 'did:plc:abc', handle: 'alice.bsky.social' }
    expect(toAuthor(raw).avatarUrl).toBeUndefined()
  })

  it('既にサフィックスが付いているURLには二重付与しない', () => {
    const raw = {
      did: 'did:plc:abc',
      handle: 'alice.bsky.social',
      avatar: 'https://cdn.bsky.app/img/avatar/plain/xxx/yyy@png',
    }
    expect(toAuthor(raw).avatarUrl).toBe('https://cdn.bsky.app/img/avatar/plain/xxx/yyy@png')
  })
})

const rawPostView = {
  uri: 'at://did:plc:abc/app.bsky.feed.post/1',
  cid: 'bafycid1',
  author: rawAuthor,
  record: { text: 'hello world', createdAt: '2026-08-01T00:00:00.000Z' },
  embed: {
    $type: 'app.bsky.embed.images#view',
    images: [{ thumb: 'https://cdn/thumb1.jpg', fullsize: 'https://cdn/full1.jpg', alt: '猫の写真' }],
  },
  replyCount: 1,
  repostCount: 2,
  likeCount: 3,
  viewer: { like: 'at://did:plc:me/app.bsky.feed.like/1', repost: undefined },
  indexedAt: '2026-08-01T00:00:01.000Z',
}

describe('toPostSummary', () => {
  it('画像embedとカウンタとviewer状態を整形する', () => {
    const result = toPostSummary(rawPostView as never)
    expect(result.text).toBe('hello world')
    expect(result.images).toEqual([
      { thumbUrl: 'https://cdn/thumb1.jpg@jpeg', fullsizeUrl: 'https://cdn/full1.jpg@jpeg', alt: '猫の写真' },
    ])
    expect(result.hasVideo).toBe(false)
    expect(result.likeCount).toBe(3)
    expect(result.viewerLikeUri).toBe('at://did:plc:me/app.bsky.feed.like/1')
    expect(result.viewerRepostUri).toBeUndefined()
  })

  it('画像embedのthumb/fullsizeに拡張子サフィックスが無い場合は@jpegを付与する', () => {
    const post = {
      ...rawPostView,
      embed: {
        $type: 'app.bsky.embed.images#view',
        images: [
          {
            thumb: 'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:xxx/bafkreixxx',
            fullsize: 'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:xxx/bafkreixxx',
            alt: 'テスト画像',
          },
        ],
      },
    } as never
    const result = toPostSummary(post)
    expect(result.images).toEqual([
      {
        thumbUrl: 'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:xxx/bafkreixxx@jpeg',
        fullsizeUrl: 'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:xxx/bafkreixxx@jpeg',
        alt: 'テスト画像',
      },
    ])
  })

  it('embedが無い投稿はimages空配列になる', () => {
    const noEmbed = { ...rawPostView, embed: undefined } as never
    expect(toPostSummary(noEmbed).images).toEqual([])
  })

  it('video embedはhasVideo=trueになる', () => {
    const video = { ...rawPostView, embed: { $type: 'app.bsky.embed.video#view' } } as never
    expect(toPostSummary(video).hasVideo).toBe(true)
  })

  it('record embed(引用)があればquotedPostを設定する', () => {
    const quoted = {
      ...rawPostView,
      embed: {
        $type: 'app.bsky.embed.record#view',
        record: {
          $type: 'app.bsky.embed.record#viewRecord',
          uri: 'at://did:plc:xyz/app.bsky.feed.post/quoted1',
          cid: 'bafyquoted1',
          author: { ...rawAuthor, handle: 'carol.bsky.social' },
          value: { text: 'quoted text', createdAt: '2026-08-01T00:00:03.000Z' },
        },
      },
    } as never
    const result = toPostSummary(quoted)
    expect(result.quotedPost).toEqual({
      status: 'available',
      author: expect.objectContaining({ handle: 'carol.bsky.social' }),
      text: 'quoted text',
      createdAt: '2026-08-01T00:00:03.000Z',
    })
  })

  it('recordWithMedia embed(画像+引用)があれば画像とquotedPostの両方を設定する', () => {
    const quotedWithMedia = {
      ...rawPostView,
      embed: {
        $type: 'app.bsky.embed.recordWithMedia#view',
        record: {
          record: {
            $type: 'app.bsky.embed.record#viewRecord',
            uri: 'at://did:plc:xyz/app.bsky.feed.post/quoted2',
            cid: 'bafyquoted2',
            author: { ...rawAuthor, handle: 'carol.bsky.social' },
            value: { text: 'quoted text2', createdAt: '2026-08-01T00:00:04.000Z' },
          },
        },
        media: {
          $type: 'app.bsky.embed.images#view',
          images: [{ thumb: 'https://cdn/thumb2.jpg', fullsize: 'https://cdn/full2.jpg', alt: '画像' }],
        },
      },
    } as never
    const result = toPostSummary(quotedWithMedia)
    expect(result.quotedPost?.status).toBe('available')
    expect(result.quotedPost?.status === 'available' && result.quotedPost.text).toBe('quoted text2')
    expect(result.images).toEqual([
      { thumbUrl: 'https://cdn/thumb2.jpg@jpeg', fullsizeUrl: 'https://cdn/full2.jpg@jpeg', alt: '画像' },
    ])
  })

  it('引用先がnotFoundならquotedPostのstatusはnot-found', () => {
    const notFoundQuote = {
      ...rawPostView,
      embed: {
        $type: 'app.bsky.embed.record#view',
        record: { $type: 'app.bsky.embed.record#viewNotFound', uri: 'at://x', notFound: true },
      },
    } as never
    expect(toPostSummary(notFoundQuote).quotedPost).toEqual({ status: 'not-found' })
  })

  it('引用先がblockedならquotedPostのstatusはblocked', () => {
    const blockedQuote = {
      ...rawPostView,
      embed: {
        $type: 'app.bsky.embed.record#view',
        record: { $type: 'app.bsky.embed.record#viewBlocked', uri: 'at://x', blocked: true },
      },
    } as never
    expect(toPostSummary(blockedQuote).quotedPost).toEqual({ status: 'blocked' })
  })

  it('引用先がdetachedならquotedPostのstatusはdetached', () => {
    const detachedQuote = {
      ...rawPostView,
      embed: {
        $type: 'app.bsky.embed.record#view',
        record: { $type: 'app.bsky.embed.record#viewDetached', uri: 'at://x', detached: true },
      },
    } as never
    expect(toPostSummary(detachedQuote).quotedPost).toEqual({ status: 'detached' })
  })

  it('引用が無ければquotedPostはundefined', () => {
    expect(toPostSummary(rawPostView as never).quotedPost).toBeUndefined()
  })
})

describe('toTimelineItems', () => {
  it('reasonRepostがあれば本体側にrepostedByを設定する', () => {
    const feedViewPost = {
      post: rawPostView,
      reason: { $type: 'app.bsky.feed.defs#reasonRepost', by: rawAuthor, indexedAt: '2026-08-01T00:00:02.000Z' },
    } as never
    const result = toTimelineItems(feedViewPost)
    expect(result).toHaveLength(1)
    expect(result[0].repostedBy?.handle).toBe('alice.bsky.social')
  })

  it('同じ投稿を異なる人がリポストした場合、sliceKeyはリポストした人ごとに異なる(dedupeTimelineItemsが同一スライス内でuriが重複するのを防ぐため)', () => {
    const reposterA = { did: 'did:plc:reposter-a', handle: 'a.bsky.social' }
    const reposterB = { did: 'did:plc:reposter-b', handle: 'b.bsky.social' }
    const feedViewPostA = {
      post: rawPostView,
      reason: { $type: 'app.bsky.feed.defs#reasonRepost', by: reposterA, indexedAt: '2026-08-01T00:00:02.000Z' },
    } as never
    const feedViewPostB = {
      post: rawPostView,
      reason: { $type: 'app.bsky.feed.defs#reasonRepost', by: reposterB, indexedAt: '2026-08-01T00:00:03.000Z' },
    } as never
    const resultA = toTimelineItems(feedViewPostA)
    const resultB = toTimelineItems(feedViewPostB)
    expect(resultA[0].sliceKey).not.toBe(resultB[0].sliceKey)
  })

  it('reasonが無ければrepostedByはundefined', () => {
    const feedViewPost = { post: rawPostView } as never
    expect(toTimelineItems(feedViewPost)[0].repostedBy).toBeUndefined()
  })

  it('reply.parentが完全な投稿(recordあり)なら、親投稿を独立した1件目として先頭に追加し、connectsToNextを立てる。本体にはreplyToHandleを設定する', () => {
    const parentPost = { ...rawPostView, uri: 'at://did:plc:abc/app.bsky.feed.post/parent', author: { ...rawAuthor, handle: 'bob.bsky.social' } }
    const feedViewPost = {
      post: rawPostView,
      reply: {
        root: parentPost,
        parent: parentPost,
      },
    } as never
    const result = toTimelineItems(feedViewPost)
    expect(result).toHaveLength(2)
    expect(result[0].post.uri).toBe('at://did:plc:abc/app.bsky.feed.post/parent')
    expect(result[0].post.author.handle).toBe('bob.bsky.social')
    expect(result[0].connectsToNext).toBe(true)
    expect(result[1].post.uri).toBe(rawPostView.uri)
    expect(result[1].replyToHandle).toBe('bob.bsky.social')
    expect(result[1].connectsToNext).toBeUndefined()
  })

  it('reply.rootとreply.parentが異なる投稿なら、root・parentの両方を独立した項目として先頭に追加し、両方にconnectsToNextを立てる。rootにはisThreadRootを立てる(中間が省略されている旨を示すため)', () => {
    const rootPost = { ...rawPostView, uri: 'at://did:plc:abc/app.bsky.feed.post/root', author: { ...rawAuthor, handle: 'carol.bsky.social' } }
    const parentPost = { ...rawPostView, uri: 'at://did:plc:abc/app.bsky.feed.post/parent', author: { ...rawAuthor, handle: 'bob.bsky.social' } }
    const feedViewPost = {
      post: rawPostView,
      reply: {
        root: rootPost,
        parent: parentPost,
      },
    } as never
    const result = toTimelineItems(feedViewPost)
    expect(result).toHaveLength(3)
    expect(result[0].post.uri).toBe('at://did:plc:abc/app.bsky.feed.post/root')
    expect(result[0].post.author.handle).toBe('carol.bsky.social')
    expect(result[0].connectsToNext).toBe(true)
    expect(result[0].isThreadRoot).toBe(true)
    // rootはそのスライスで最も古い投稿(スレッドの起点)なのでisSliceRootが立つ(インデント抑制用)
    expect(result[0].isSliceRoot).toBe(true)
    expect(result[1].post.uri).toBe('at://did:plc:abc/app.bsky.feed.post/parent')
    expect(result[1].post.author.handle).toBe('bob.bsky.social')
    expect(result[1].connectsToNext).toBe(true)
    expect(result[1].isThreadRoot).toBeUndefined()
    // parentはrootではないのでisSliceRootは立たない(文脈表示としてインデントされるべき)
    expect(result[1].isSliceRoot).toBe(false)
    expect(result[2].post.uri).toBe(rawPostView.uri)
    expect(result[2].replyToHandle).toBe('bob.bsky.social')
    expect(result[2].connectsToNext).toBeUndefined()
    // 同一feedエントリ由来の全アイテムは同じsliceKey(本体のuri)を持つ
    expect(result[0].sliceKey).toBe(rawPostView.uri)
    expect(result[1].sliceKey).toBe(rawPostView.uri)
    expect(result[2].sliceKey).toBe(rawPostView.uri)
    // 全アイテムはこのスレッドの起点(reply.root)のuriをrootUriとして持つ
    expect(result[0].rootUri).toBe('at://did:plc:abc/app.bsky.feed.post/root')
    expect(result[1].rootUri).toBe('at://did:plc:abc/app.bsky.feed.post/root')
    expect(result[2].rootUri).toBe('at://did:plc:abc/app.bsky.feed.post/root')
  })

  it('root!==parentの場合、parent複製にはreplyToHandleを設定しない(↳マーカーは出さず、indentのみで文脈表示と示す)', () => {
    const rootPost = { ...rawPostView, uri: 'at://did:plc:abc/app.bsky.feed.post/root', author: { ...rawAuthor, handle: 'carol.bsky.social' } }
    const parentPost = { ...rawPostView, uri: 'at://did:plc:abc/app.bsky.feed.post/parent', author: { ...rawAuthor, handle: 'bob.bsky.social' } }
    const feedViewPost = {
      post: rawPostView,
      reply: { root: rootPost, parent: parentPost },
    } as never
    const result = toTimelineItems(feedViewPost)
    expect(result[1].post.uri).toBe('at://did:plc:abc/app.bsky.feed.post/parent')
    expect(result[1].replyToHandle).toBeUndefined()
  })

  it('replyが無ければrootUriは自分自身のuri', () => {
    const feedViewPost = { post: rawPostView } as never
    expect(toTimelineItems(feedViewPost)[0].rootUri).toBe(rawPostView.uri)
  })

  it('reply.rootとreply.parentが同一投稿(1階層のみの返信)なら、parent複製にisThreadRootは立たないが、parent自身がスレッドの起点なのでisSliceRootは立つ', () => {
    const parentPost = { ...rawPostView, uri: 'at://did:plc:abc/app.bsky.feed.post/parent', author: { ...rawAuthor, handle: 'bob.bsky.social' } }
    const feedViewPost = {
      post: rawPostView,
      reply: { root: parentPost, parent: parentPost },
    } as never
    const result = toTimelineItems(feedViewPost)
    expect(result[0].isThreadRoot).toBeUndefined()
    expect(result[0].isSliceRoot).toBe(true)
  })

  it('reply.rootがblockedPost等(recordなし)でreply.parentが完全な投稿なら、parent複製と本体の2件のみになる', () => {
    const parentPost = { ...rawPostView, uri: 'at://did:plc:abc/app.bsky.feed.post/parent', author: { ...rawAuthor, handle: 'bob.bsky.social' } }
    const feedViewPost = {
      post: rawPostView,
      reply: {
        root: { $type: 'app.bsky.feed.defs#blockedPost', uri: 'at://did:plc:abc/app.bsky.feed.post/root' },
        parent: parentPost,
      },
    } as never
    const result = toTimelineItems(feedViewPost)
    expect(result).toHaveLength(2)
    expect(result[0].post.uri).toBe('at://did:plc:abc/app.bsky.feed.post/parent')
    expect(result[0].connectsToNext).toBe(true)
    expect(result[1].replyToHandle).toBe('bob.bsky.social')
  })

  it('返信投稿のリポストの場合、親投稿は追加せず本体にrepostedByとreplyToHandleを両方設定する', () => {
    const parentPost = { ...rawPostView, uri: 'at://did:plc:abc/app.bsky.feed.post/parent', author: { ...rawAuthor, handle: 'bob.bsky.social' } }
    const feedViewPost = {
      post: rawPostView,
      reason: { $type: 'app.bsky.feed.defs#reasonRepost', by: rawAuthor, indexedAt: '2026-08-01T00:00:02.000Z' },
      reply: {
        root: parentPost,
        parent: parentPost,
      },
    } as never
    const result = toTimelineItems(feedViewPost)
    expect(result).toHaveLength(1)
    expect(result[0].post.uri).toBe(rawPostView.uri)
    expect(result[0].repostedBy?.handle).toBe('alice.bsky.social')
    expect(result[0].replyToHandle).toBe('bob.bsky.social')
  })

  it('replyが無ければ1件のみ、replyToHandleはundefined', () => {
    const feedViewPost = { post: rawPostView } as never
    const result = toTimelineItems(feedViewPost)
    expect(result).toHaveLength(1)
    expect(result[0].replyToHandle).toBeUndefined()
  })

  it('reply.parentがblockedPost等(recordなし)なら親投稿は追加せず、本体にreplyToHandleを設定する', () => {
    const feedViewPost = {
      post: rawPostView,
      reply: {
        root: { author: rawAuthor },
        parent: { $type: 'app.bsky.feed.defs#blockedPost', author: { ...rawAuthor, handle: 'bob.bsky.social' } },
      },
    } as never
    const result = toTimelineItems(feedViewPost)
    expect(result).toHaveLength(1)
    expect(result[0].replyToHandle).toBe('bob.bsky.social')
  })

  it('reply.parentがnotFoundPost等でauthor情報も無ければreplyToHandleはundefined', () => {
    const feedViewPost = {
      post: rawPostView,
      reply: {
        root: { author: rawAuthor },
        parent: { $type: 'app.bsky.feed.defs#notFoundPost' },
      },
    } as never
    const result = toTimelineItems(feedViewPost)
    expect(result).toHaveLength(1)
    expect(result[0].replyToHandle).toBeUndefined()
  })
})

describe('formatRelativeTime', () => {
  it('60秒未満の差分は「たった今」', () => {
    const now = new Date('2026-08-01T00:00:30.000Z')
    const createdAt = '2026-08-01T00:00:00.000Z'
    expect(formatRelativeTime(createdAt, now)).toBe('たった今')
  })

  it('1分以上60分未満は「N分前」', () => {
    const now = new Date(new Date('2026-08-01T00:00:00.000Z').getTime() + 300000)
    const createdAt = '2026-08-01T00:00:00.000Z'
    expect(formatRelativeTime(createdAt, now)).toBe('5分前')
  })

  it('1時間以上24時間未満は「N時間前」', () => {
    const now = new Date(new Date('2026-08-01T00:00:00.000Z').getTime() + 3 * 3600000)
    const createdAt = '2026-08-01T00:00:00.000Z'
    expect(formatRelativeTime(createdAt, now)).toBe('3時間前')
  })

  it('1日以上7日未満は「N日前」', () => {
    const now = new Date(new Date('2026-08-01T00:00:00.000Z').getTime() + 2 * 86400000)
    const createdAt = '2026-08-01T00:00:00.000Z'
    expect(formatRelativeTime(createdAt, now)).toBe('2日前')
  })

  it('7日以上前は「YYYY/MM/DD」形式', () => {
    const createdAt = '2026-07-01T00:00:00.000Z'
    const now = new Date('2026-08-02T00:00:00.000Z')
    expect(formatRelativeTime(createdAt, now)).toBe('2026/07/01')
  })
})

describe('toNotificationItem', () => {
  it('既知のreasonはそのまま、未知は other になる', () => {
    const known = toNotificationItem({
      uri: 'at://x/1',
      author: rawAuthor,
      reason: 'like',
      isRead: false,
      indexedAt: '2026-08-01T00:00:00.000Z',
    })
    expect(known.reason).toBe('like')

    const unknown = toNotificationItem({
      uri: 'at://x/2',
      author: rawAuthor,
      reason: 'starterpack-joined',
      isRead: true,
      indexedAt: '2026-08-01T00:00:00.000Z',
    })
    expect(unknown.reason).toBe('other')
  })
})

describe('postWebUrl', () => {
  it('uriのrkeyとauthorのhandleからBluesky Web版のURLを組み立てる', () => {
    const post = { ...rawPostView, uri: 'at://did:plc:abc/app.bsky.feed.post/xyz123' }
    const result = toPostSummary(post as never)
    expect(postWebUrl(result)).toBe('https://bsky.app/profile/alice.bsky.social/post/xyz123')
  })

  it('authorのhandleがhandle.invalidの場合はdidにフォールバックする', () => {
    const post = {
      ...rawPostView,
      uri: 'at://did:plc:abc/app.bsky.feed.post/xyz123',
      author: { ...rawAuthor, handle: 'handle.invalid' },
    }
    const result = toPostSummary(post as never)
    expect(postWebUrl(result)).toBe('https://bsky.app/profile/did:plc:abc/post/xyz123')
  })
})
