import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Box, Text, useInput, measureElement } from 'ink'
import type { DOMElement } from 'ink'
import open from 'open'
import { PostItem } from '../components/PostItem.js'
import { StatusBar } from '../components/StatusBar.js'
import { ConfirmDialog } from '../components/ConfirmDialog.js'
import { ScrollingViewport, OVERHEAD_ROWS } from '../components/ScrollingViewport.js'
import { dedupeTimelineItems, fetchAuthorFeed, toggleLike, toggleRepost } from '../api/client.js'
import { postWebUrl } from '../api/format.js'
import { resolveListNavigation } from '../keymap/vim-list-keymap.js'
import { resolveGlobalAction } from '../keymap/global-keymap.js'
import { useTerminalRows } from '../navigation/useTerminalRows.js'
import type { ConfirmAction } from './confirm-action.js'
import type { AtpClient } from '../api/atp-client.js'
import type { PostSummary, TimelineItem } from '../api/types.js'

interface ProfileData {
  handle: string
  displayName?: string
  description?: string
  followersCount?: number
  followsCount?: number
  postsCount?: number
}

export function ProfileScreen({
  client,
  actor,
  active,
  onBack,
  onOpenThread,
  onReply,
  initialItems,
  initialCursor,
  initialIndex,
  onStateChange,
}: {
  client: AtpClient
  actor: string
  active: boolean
  onBack: () => void
  onOpenThread: (uri: string) => void
  onReply: (post: PostSummary) => void
  initialItems: TimelineItem[]
  initialCursor: string | undefined
  initialIndex: number
  onStateChange: (state: { items: TimelineItem[]; cursor: string | undefined; index: number }) => void
}) {
  const [profile, setProfile] = useState<ProfileData>()
  const [profileError, setProfileError] = useState<string>()

  const [items, setItems] = useState<TimelineItem[]>(initialItems)
  const [cursor, setCursor] = useState<string | undefined>(initialCursor)
  const [index, setIndex] = useState(initialIndex)
  const [feedLoading, setFeedLoading] = useState(initialItems.length === 0)
  const [feedError, setFeedError] = useState<string>()
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  // dedupeTimelineItemsのseenUrisをページをまたいで永続化する(TimelineScreenと同じ理由)。
  const seenUrisRef = useRef<Set<string>>(new Set(initialItems.map((it) => it.post.uri)))

  useEffect(() => {
    let cancelled = false
    client
      .getProfile({ actor })
      .then((res) => {
        if (cancelled) return
        const p = res.data
        setProfile({
          handle: p.handle,
          displayName: p.displayName,
          description: p.description,
          followersCount: p.followersCount,
          followsCount: p.followsCount,
          postsCount: p.postsCount,
        })
      })
      .catch(() => {
        if (!cancelled) setProfileError('接続エラー — hで戻る')
      })
    return () => {
      cancelled = true
    }
  }, [client, actor])

  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    try {
      const page = await fetchAuthorFeed(client, actor, cursor)
      const deduped = dedupeTimelineItems(page.items, seenUrisRef.current)
      setItems((prev) => [...prev, ...deduped])
      setCursor(page.cursor)
      setFeedError(undefined)
    } catch {
      setFeedError('接続エラー — rで再試行')
    } finally {
      setFeedLoading(false)
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, actor, cursor])

  useEffect(() => {
    if (initialItems.length === 0) {
      loadMore()
    }
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
      if (key.escape || input === 'h') {
        onBack()
        return
      }
      if (feedError && items.length === 0) {
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

      const current = items[index]
      if (!current) return
      const action = resolveGlobalAction(input, key)
      if (action === 'open-thread') onOpenThread(current.post.uri)
      if (action === 'reply') onReply(current.post)
      if (action === 'open-link') {
        open(postWebUrl(current.post)).catch(() => {})
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
        if (action.type === 'repost') {
          toggleRepost(client, action.post)
            .then((patch) => {
              setItems((prev) => prev.map((it) => (it.post.uri === action.post.uri ? { ...it, post: { ...it.post, ...patch } } : it)))
              setFeedError(undefined)
            })
            .catch(() => {
              setFeedError('リポストに失敗しました')
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
  const headerRef = useRef<DOMElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)

  useLayoutEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(measureElement(headerRef.current).height)
    }
  }, [profile])

  if (profileError) {
    return (
      <Box flexDirection="column">
        <StatusBar hint=" " error={profileError} />
        {confirmAction?.type === 'repost' && (
          <ConfirmDialog
            message="この投稿をリポストしますか?"
            confirmLabel={confirmAction.post.viewerRepostUri ? 'y: リポスト解除' : 'y: リポスト'}
          />
        )}
      </Box>
    )
  }
  if (!profile) {
    return (
      <Box flexDirection="column">
        <StatusBar hint=" " status="読み込み中..." />
        {confirmAction?.type === 'repost' && (
          <ConfirmDialog
            message="この投稿をリポストしますか?"
            confirmLabel={confirmAction.post.viewerRepostUri ? 'y: リポスト解除' : 'y: リポスト'}
          />
        )}
      </Box>
    )
  }

  const availableRows = Math.max(1, rows - headerHeight - OVERHEAD_ROWS)

  return (
    <Box flexDirection="column">
      <Box ref={headerRef} flexDirection="column" borderStyle="single" paddingX={1}>
        <Text bold color="yellow">{profile.displayName ?? profile.handle}</Text>
        <Text color="#666666">@{profile.handle}</Text>
        {profile.description && <Text>{profile.description}</Text>}
        <Box gap={2}>
          <Text>フォロー {profile.followsCount ?? 0}</Text>
          <Text>フォロワー {profile.followersCount ?? 0}</Text>
          <Text>投稿 {profile.postsCount ?? 0}</Text>
        </Box>
      </Box>
      {!feedLoading && (
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
      )}
      <StatusBar hint=" " status={feedLoading || isLoadingMore ? '読み込み中...' : undefined} error={feedError} />
      {confirmAction?.type === 'repost' && (
        <ConfirmDialog
          message="この投稿をリポストしますか?"
          confirmLabel={confirmAction.post.viewerRepostUri ? 'y: リポスト解除' : 'y: リポスト'}
        />
      )}
    </Box>
  )
}
