import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import open from 'open'
import { PostItem } from '../components/PostItem.js'
import { StatusBar } from '../components/StatusBar.js'
import { ConfirmDialog } from '../components/ConfirmDialog.js'
import { ScrollingViewport, OVERHEAD_ROWS } from '../components/ScrollingViewport.js'
import { fetchNotifications, toggleRepost } from '../api/client.js'
import { resolveListNavigation } from '../keymap/vim-list-keymap.js'
import { resolveGlobalAction } from '../keymap/global-keymap.js'
import { formatRelativeTime, postWebUrl } from '../api/format.js'
import { useTerminalRows } from '../navigation/useTerminalRows.js'
import type { ConfirmAction } from './confirm-action.js'
import type { AtpClient } from '../api/atp-client.js'
import type { NotificationItem, PostSummary } from '../api/types.js'

const REASON_LABEL: Record<NotificationItem['reason'], string> = {
  like: 'があなたの投稿をいいねしました',
  repost: 'があなたの投稿をリポストしました',
  follow: 'があなたをフォローしました',
  mention: 'あなたにメンション',
  reply: '返信しました',
  quote: '引用しました',
  other: '通知',
}

export function NotificationsScreen({
  client,
  active,
  initialItems,
  initialCursor,
  initialIndex,
  onStateChange,
  onOpenThread,
  onOpenProfile,
  onQuote,
}: {
  client: AtpClient
  active: boolean
  initialItems: NotificationItem[]
  initialCursor: string | undefined
  initialIndex: number
  onStateChange: (state: { items: NotificationItem[]; cursor: string | undefined; index: number }) => void
  onOpenThread: (uri: string) => void
  onOpenProfile: (actor?: string) => void
  onQuote: (post: PostSummary) => void
}) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems)
  const [cursor, setCursor] = useState<string | undefined>(initialCursor)
  const [index, setIndex] = useState(initialIndex)
  const [loading, setLoading] = useState(initialItems.length === 0)
  const [error, setError] = useState<string>()
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    try {
      const page = await fetchNotifications(client, cursor)
      setItems((prev) => [...prev, ...page.items])
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

  const reloadNotifications = useCallback(async () => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    const currentUri = items[index]?.uri
    try {
      const page = await fetchNotifications(client, undefined)
      setItems(page.items)
      setCursor(page.cursor)
      const newIndex = currentUri ? page.items.findIndex((it) => it.uri === currentUri) : -1
      setIndex(newIndex >= 0 ? newIndex : 0)
      setError(undefined)
    } catch {
      setError('接続エラー — rで再試行')
    } finally {
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  useEffect(() => {
    if (initialItems.length === 0) {
      loadMore()
    } else {
      reloadNotifications()
    }
    client.updateSeenNotifications().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (action === 'open-thread') {
        const current = items[index]
        const canOpen =
          current && (current.reason === 'like' || current.reason === 'repost' || current.reason === 'quote' || current.reason === 'reply')
        if (canOpen && current.subjectPost) onOpenThread(current.subjectPost.uri)
        return
      }
      if (action === 'view-author') {
        const current = items[index]
        if (current) onOpenProfile(current.author.did)
      }
      if (action === 'open-link') {
        const current = items[index]
        if (current?.subjectPost?.linkCard) open(current.subjectPost.linkCard.uri).catch(() => {})
      }
      if (action === 'open-post') {
        const current = items[index]
        if (current?.subjectPost) open(postWebUrl(current.subjectPost)).catch(() => {})
      }
      if (action === 'repost') {
        const current = items[index]
        if (current?.subjectPost) setConfirmAction({ type: 'repost', post: current.subjectPost })
      }
      if (action === 'quote') {
        const current = items[index]
        if (current?.subjectPost) onQuote(current.subjectPost)
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
        if (action.type === 'repost') {
          toggleRepost(client, action.post)
            .then((patch) => {
              setItems((prev) =>
                prev.map((it) =>
                  it.subjectPost && it.subjectPost.uri === action.post.uri ? { ...it, subjectPost: { ...it.subjectPost, ...patch } } : it,
                ),
              )
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
        getKey={(item) => item.uri}
        renderItem={(item, selected) => {
          const showsPostItem = (item.reason === 'quote' || item.reason === 'reply') && item.subjectPost
          return (
            <Box flexDirection="column" width="100%">
              {!showsPostItem && (
                <Box
                  width="100%"
                  borderStyle="single"
                  borderTop={false}
                  borderRight={false}
                  borderBottom={!item.subjectPost}
                  borderLeft={true}
                  borderBottomColor="gray"
                  borderLeftColor={selected ? 'cyan' : 'gray'}
                  paddingLeft={1}
                  paddingRight={3}
                >
                  <Text bold color="yellow">
                    {item.author.displayName ?? item.author.handle}
                    {item.additionalAuthors && item.additionalAuthors.length > 0 && ` および他${item.additionalAuthors.length}人`}
                  </Text>
                  <Text bold={!item.isRead}> {REASON_LABEL[item.reason]}</Text>
                  <Text color="#666666"> · {formatRelativeTime(item.indexedAt)}</Text>
                </Box>
              )}
              {(item.reason === 'like' || item.reason === 'repost') && item.subjectPost && (
                <Box
                  flexDirection="column"
                  width="100%"
                  borderStyle="single"
                  borderTop={false}
                  borderRight={false}
                  borderBottom={true}
                  borderLeft={true}
                  borderBottomColor="gray"
                  borderLeftColor={selected ? 'cyan' : 'gray'}
                  paddingLeft={1}
                  paddingRight={3}
                >
                  <Text color="#666666" wrap="truncate-end">
                    {item.subjectPost.text.replace(/\s*\n+\s*/g, ' ').trim()}
                  </Text>
                  <Text color={item.subjectPost.viewerRepostUri ? 'green' : undefined}>↻ {item.subjectPost.repostCount}</Text>
                </Box>
              )}
              {showsPostItem && (
                <PostItem
                  post={item.subjectPost!}
                  selected={selected}
                  expanded={false}
                  replyToHandle={item.reason === 'reply' ? item.replyToHandle : undefined}
                  replyIndent={false}
                />
              )}
            </Box>
          )
        }}
      />
      <StatusBar hint=" " status={isLoadingMore ? '読み込み中...' : undefined} error={error} />
      {confirmAction?.type === 'repost' && (
        <ConfirmDialog
          message="この投稿をリポストしますか?"
          confirmLabel={confirmAction.post.viewerRepostUri ? 'y: リポスト解除' : 'y: リポスト'}
        />
      )}
    </Box>
  )
}
