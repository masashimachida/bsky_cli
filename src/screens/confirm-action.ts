import type { PostSummary } from '../api/types.js'

export type ConfirmAction = { type: 'delete'; post: PostSummary } | { type: 'repost'; post: PostSummary }
