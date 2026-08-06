import type { AppBskyActorDefs, AppBskyFeedDefs, AppBskyNotificationListNotifications } from '@atproto/api'

export interface AtpPostRecordInput {
  text: string
  createdAt?: string
  reply?: {
    root: { uri: string; cid: string }
    parent: { uri: string; cid: string }
  }
  embed?: {
    $type: 'app.bsky.embed.record'
    record: { uri: string; cid: string }
  }
}

export interface AtpClient {
  did?: string
  getTimeline(params: {
    cursor?: string
    limit?: number
  }): Promise<{ data: { cursor?: string; feed: AppBskyFeedDefs.FeedViewPost[] } }>
  getAuthorFeed(params: {
    actor: string
    cursor?: string
    limit?: number
  }): Promise<{ data: { cursor?: string; feed: AppBskyFeedDefs.FeedViewPost[] } }>
  getPostThread(params: { uri: string }): Promise<{ data: { thread: unknown } }>
  getPosts(params: { uris: string[] }): Promise<{ data: { posts: AppBskyFeedDefs.PostView[] } }>
  post(record: AtpPostRecordInput): Promise<{ uri: string; cid: string }>
  like(uri: string, cid: string): Promise<{ uri: string }>
  deleteLike(likeUri: string): Promise<void>
  repost(uri: string, cid: string): Promise<{ uri: string }>
  deleteRepost(repostUri: string): Promise<void>
  deletePost(postUri: string): Promise<void>
  getProfile(params: { actor: string }): Promise<{ data: AppBskyActorDefs.ProfileViewDetailed }>
  listNotifications(params: {
    cursor?: string
    limit?: number
  }): Promise<{ data: { cursor?: string; notifications: AppBskyNotificationListNotifications.Notification[] } }>
  updateSeenNotifications(seenAt?: string): Promise<void>
  countUnreadNotifications(): Promise<{ data: { count: number } }>
  app: {
    bsky: {
      feed: {
        searchPosts(params: {
          q: string
          cursor?: string
          limit?: number
        }): Promise<{ data: { cursor?: string; posts: AppBskyFeedDefs.PostView[] } }>
      }
    }
  }
}
