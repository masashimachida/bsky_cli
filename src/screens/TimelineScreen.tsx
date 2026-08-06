import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, useInput } from 'ink'
import open from 'open'
import { PostItem } from '../components/PostItem.js'
import { StatusBar } from '../components/StatusBar.js'
import { ConfirmDialog } from '../components/ConfirmDialog.js'
import { ScrollingViewport, OVERHEAD_ROWS } from '../components/ScrollingViewport.js'
import {
  dedupeTimelineItems,
  deletePost,
  fetchTimeline,
  mergeNewTimelineItems,
  toggleLike,
  toggleRepost,
} from '../api/client.js'
import { postWebUrl } from '../api/format.js'
import { resolveListNavigation } from '../keymap/vim-list-keymap.js'
import { resolveGlobalAction } from '../keymap/global-keymap.js'
import { useTerminalRows } from '../navigation/useTerminalRows.js'
import type { ConfirmAction } from './confirm-action.js'
import type { AtpClient } from '../api/atp-client.js'
import type { PostSummary, TimelineItem } from '../api/types.js'

const AUTO_REFRESH_INTERVAL_MS = 60000

export function TimelineScreen({
  client,
  active,
  initialItems,
  initialCursor,
  initialIndex,
  onStateChange,
  onOpenThread,
  onReply,
  onCompose,
  onOpenProfile,
}: {
  client: AtpClient
  active: boolean
  initialItems: TimelineItem[]
  initialCursor: string | undefined
  initialIndex: number
  onStateChange: (state: { items: TimelineItem[]; cursor: string | undefined; index: number }) => void
  onOpenThread: (uri: string) => void
  onReply: (post: PostSummary) => void
  onCompose: () => void
  onOpenProfile: (actor?: string) => void
}) {
  const [items, setItems] = useState<TimelineItem[]>(initialItems)
  const [cursor, setCursor] = useState<string | undefined>(initialCursor)
  const [index, setIndex] = useState(initialIndex)
  const [loading, setLoading] = useState(initialItems.length === 0)
  const [error, setError] = useState<string>()
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  // dedupeTimelineItemsのseenUris/seenRootUrisをページをまたいで永続化する
  // (公式実装のFeedTunerインスタンスと同じ理由)。毎回新規Setで全アイテムを再dedupeすると、
  // 既に破棄されたスライスの投稿が後続ページで「初見」扱いになり単独浮遊表示されてしまう。
  const seenUrisRef = useRef<Set<string>>(new Set(initialItems.map((it) => it.post.uri)))
  const seenRootUrisRef = useRef<Set<string>>(
    new Set(initialItems.filter((it) => it.repostedBy === undefined).map((it) => it.rootUri)),
  )

  const latestStateRef = useRef({ items, cursor, index })
  latestStateRef.current = { items, cursor, index }

  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    try {
      const page = await fetchTimeline(client, cursor)
      const deduped = dedupeTimelineItems(page.items, seenUrisRef.current, seenRootUrisRef.current)
      setItems((prev) => [...prev, ...deduped])
      setCursor(page.cursor)
      setError(undefined)
    } catch {
      setError('接続エラー — rで再試行')
    } finally {
      setLoading(false)
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, cursor])

  // silent=trueはタイマーによるバックグラウンド自動更新。ローディング表示やエラー
  // 表示を出さず、失敗時は次回のタイマー発火に任せて黙って諦める。
  const reloadTimeline = useCallback(
    async (silent = false) => {
      if (isLoadingMoreRef.current) return
      isLoadingMoreRef.current = true
      if (!silent) setIsLoadingMore(true)
      try {
        const page = await fetchTimeline(client, undefined)
        const merged = mergeNewTimelineItems(
          latestStateRef.current.items,
          latestStateRef.current.index,
          page.items,
          seenUrisRef.current,
          seenRootUrisRef.current,
        )
        setItems(merged.items)
        setIndex(merged.index)
        if (!silent) setError(undefined)
      } catch {
        if (!silent) setError('接続エラー — rで再試行')
      } finally {
        isLoadingMoreRef.current = false
        if (!silent) setIsLoadingMore(false)
      }
    },
    [client],
  )

  useEffect(() => {
    if (initialItems.length === 0) {
      loadMore()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reloadTimelineRef = useRef(reloadTimeline)
  reloadTimelineRef.current = reloadTimeline

  useEffect(() => {
    const interval = setInterval(() => {
      reloadTimelineRef.current(true)
    }, AUTO_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => {
    return () => {
      onStateChange(latestStateRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useInput(
    (input, key) => {
      if (error && items.length === 0) {
        if (input === 'r') loadMore()
        return
      }

      const nav = resolveListNavigation(input, key)
      if (nav === 'down') {
        setIndex((i) => {
          const next = Math.min(items.length - 1, i + 1)
          if (next >= items.length - 3 && cursor) loadMore()
          return next
        })
        return
      }
      if (nav === 'up') {
        if (index === 0) {
          reloadTimeline()
          return
        }
        setIndex((i) => Math.max(0, i - 1))
        return
      }
      if (nav === 'top') {
        setIndex(0)
        return
      }
      if (nav === 'bottom') {
        setIndex(items.length - 1)
        return
      }

      const action = resolveGlobalAction(input, key)

      const current = items[index]
      if (!current) return
      if (action === 'open-thread') onOpenThread(current.post.uri)
      if (action === 'reply') onReply(current.post)
      if (action === 'compose') onCompose()
      if (action === 'view-author') onOpenProfile(current.post.author.did)
      if (action === 'open-link') {
        if (current.post.linkCard) open(current.post.linkCard.uri).catch(() => {})
      }
      if (action === 'open-post') {
        open(postWebUrl(current.post)).catch(() => {})
      }
      if (action === 'delete') {
        if (current.post.author.did === client.did) {
          setConfirmAction({ type: 'delete', post: current.post })
        }
      }
      if (action === 'like') {
        toggleLike(client, current.post).then((patch) => {
          setItems((prev) => prev.map((it, i) => (i === index ? { ...it, post: { ...it.post, ...patch } } : it)))
        })
      }
      if (action === 'repost') {
        setConfirmAction({ type: 'repost', post: current.post })
      }
    },
    { isActive: active && !confirmAction },
  )

  useInput(
    (input, key) => {
      if (input === 'y') {
        const action = confirmAction
        if (!action) return
        setConfirmAction(null)
        if (action.type === 'delete') {
          deletePost(client, action.post)
            .then(() => {
              setItems((prev) => {
                const next = prev.filter((it) => it.post.uri !== action.post.uri)
                setIndex((i) => Math.min(i, Math.max(0, next.length - 1)))
                return next
              })
              setError(undefined)
            })
            .catch(() => {
              setError('削除に失敗しました')
            })
        }
        if (action.type === 'repost') {
          toggleRepost(client, action.post)
            .then((patch) => {
              setItems((prev) => prev.map((it) => (it.post.uri === action.post.uri ? { ...it, post: { ...it.post, ...patch } } : it)))
              setError(undefined)
            })
            .catch(() => {
              setError('リポストに失敗しました')
            })
        }
        return
      }
      if (input === 'n' || key.escape) {
        setConfirmAction(null)
      }
    },
    { isActive: active && !!confirmAction },
  )

  const rows = useTerminalRows()

  if (loading) {
    return (
      <Box flexDirection="column">
        <StatusBar hint=" " status="読み込み中..." />
      </Box>
    )
  }

  const availableRows = Math.max(1, rows - OVERHEAD_ROWS)

  return (
    <Box flexDirection="column">
      <ScrollingViewport
        items={items}
        selectedIndex={index}
        availableRows={availableRows}
        isSelectedExpanded={false}
        getKey={(item) => item.post.uri}
        renderItem={(item, selected) => (
          <PostItem
            post={item.post}
            selected={selected}
            expanded={false}
            repostedByHandle={item.repostedBy?.handle}
            replyToHandle={item.replyToHandle}
            connectsToNext={item.connectsToNext}
            showThreadHint={item.isThreadRoot}
            indent={item.connectsToNext && !item.isSliceRoot}
            showReplyMarker={false}
          />
        )}
      />
      <StatusBar hint=" " status={isLoadingMore ? '読み込み中...' : undefined} error={error} />
      {confirmAction?.type === 'delete' && <ConfirmDialog message="この投稿を削除しますか?" />}
      {confirmAction?.type === 'repost' && (
        <ConfirmDialog
          message="この投稿をリポストしますか?"
          confirmLabel={confirmAction.post.viewerRepostUri ? 'y: リポスト解除' : 'y: リポスト'}
        />
      )}
    </Box>
  )
}
