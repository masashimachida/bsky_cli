import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, useInput } from 'ink'
import { PostItem } from '../components/PostItem.js'
import { StatusBar } from '../components/StatusBar.js'
import { ConfirmDialog } from '../components/ConfirmDialog.js'
import { ScrollingViewport, OVERHEAD_ROWS } from '../components/ScrollingViewport.js'
import { dedupeTimelineItems, deletePost, fetchTimeline, toggleLike, toggleRepost } from '../api/client.js'
import { resolveListNavigation } from '../keymap/vim-list-keymap.js'
import { resolveGlobalAction } from '../keymap/global-keymap.js'
import { useTerminalRows } from '../navigation/useTerminalRows.js'
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
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<PostSummary | null>(null)

  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    try {
      const page = await fetchTimeline(client, cursor)
      setItems((prev) => dedupeTimelineItems([...prev, ...page.items]))
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

  const reloadTimeline = useCallback(async () => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    const currentUri = items[0]?.post.uri
    try {
      const page = await fetchTimeline(client, undefined)
      const newItems = dedupeTimelineItems(page.items)
      setItems(newItems)
      setCursor(page.cursor)
      const newIndex = currentUri ? newItems.findIndex((it) => it.post.uri === currentUri) : -1
      setIndex(newIndex >= 0 ? newIndex : 0)
      setError(undefined)
    } catch {
      setError('接続エラー — rで再試行')
    } finally {
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [client, items])

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
      reloadTimelineRef.current()
    }, AUTO_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const latestStateRef = useRef({ items, cursor, index })
  latestStateRef.current = { items, cursor, index }
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
      if (action === 'delete') {
        if (current.post.author.did === client.did) {
          setConfirmDeleteTarget(current.post)
        }
      }
      if (action === 'like') {
        toggleLike(client, current.post).then((patch) => {
          setItems((prev) => prev.map((it, i) => (i === index ? { ...it, post: { ...it.post, ...patch } } : it)))
        })
      }
      if (action === 'repost') {
        toggleRepost(client, current.post).then((patch) => {
          setItems((prev) => prev.map((it, i) => (i === index ? { ...it, post: { ...it.post, ...patch } } : it)))
        })
      }
    },
    { isActive: active && !confirmDeleteTarget },
  )

  useInput(
    (input, key) => {
      if (input === 'y') {
        const target = confirmDeleteTarget
        if (!target) return
        setConfirmDeleteTarget(null)
        deletePost(client, target)
          .then(() => {
            setItems((prev) => {
              const next = prev.filter((it) => it.post.uri !== target.uri)
              setIndex((i) => Math.min(i, Math.max(0, next.length - 1)))
              return next
            })
            setError(undefined)
          })
          .catch(() => {
            setError('削除に失敗しました')
          })
        return
      }
      if (input === 'n' || key.escape) {
        setConfirmDeleteTarget(null)
      }
    },
    { isActive: active && !!confirmDeleteTarget },
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
          />
        )}
      />
      <StatusBar hint=" " status={isLoadingMore ? '読み込み中...' : undefined} error={error} />
      {confirmDeleteTarget && <ConfirmDialog message="この投稿を削除しますか?" />}
    </Box>
  )
}
