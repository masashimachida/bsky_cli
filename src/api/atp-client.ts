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

export interface AtpSavedFeed {
  id: string
  type: string
  value: string
  pinned: boolean
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
  getPreferences(): Promise<{ savedFeeds: AtpSavedFeed[] }>
  follow(subjectDid: string): Promise<{ uri: string; cid: string }>
  deleteFollow(followUri: string): Promise<void>
  mute(actor: string): Promise<void>
  unmute(actor: string): Promise<void>
  com: {
    atproto: {
      repo: {
        createRecord(params: {
          repo: string
          collection: string
          record: { $type: string; [key: string]: unknown }
        }): Promise<{ data: { uri: string; cid: string } }>
        deleteRecord(params: { repo: string; collection: string; rkey: string }): Promise<unknown>
      }
    }
  }
  app: {
    bsky: {
      feed: {
        searchPosts(params: {
          q: string
          cursor?: string
          limit?: number
        }): Promise<{ data: { cursor?: string; posts: AppBskyFeedDefs.PostView[] } }>
        getFeed(params: {
          feed: string
          cursor?: string
          limit?: number
        }): Promise<{ data: { cursor?: string; feed: AppBskyFeedDefs.FeedViewPost[] } }>
        getFeedGenerators(params: { feeds: string[] }): Promise<{
          data: {
            feeds: Array<{
              uri: string
              displayName: string
              description?: string
              creator: { handle: string; displayName?: string }
            }>
          }
        }>
      }
    }
  }
}
