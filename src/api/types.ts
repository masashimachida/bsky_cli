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
  isThreadRoot?: boolean
  // このスライス内で最も古い投稿(root、またはroot===parentの場合はparent自身)であることを示す。
  // スレッドの起点そのものは「誰かへの返信」ではないため、インデント判定から除外するために使う。
  // isThreadRootはroot!==parentの場合のroot複製にのみ立つが、isSliceRootはroot===parentの場合の
  // parent複製にも立つ点が異なる(そのケースではparent自身がスレッドの起点でもあるため)。
  isSliceRoot?: boolean
  // 同一feedエントリ(root?→parent?→本体)由来のアイテムをグルーピングするための識別子。
  // 本体のuriを使う。dedupeTimelineItemsがスライス単位で重複解決するために必要。
  sliceKey: string
  // このアイテムが属するスレッドの起点(reply.root、無ければ自分自身)のuri。
  // 同じスレッドから複数のフィードエントリが流れてきた場合、最初の1件だけを残すために使う。
  rootUri: string
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
