import React, { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { fetchSavedFeeds } from '../api/client.js'
import { resolveListNavigation } from '../keymap/vim-list-keymap.js'
import { useStatusMessage } from '../navigation/useStatusMessage.js'
import type { StatusMessage } from '../navigation/useStatusMessage.js'
import type { AtpClient } from '../api/atp-client.js'
import type { FeedInfo } from '../api/types.js'

export function FeedListScreen({
  client,
  active,
  onOpenFeed,
  onStatusChange,
}: {
  client: AtpClient
  active: boolean
  onOpenFeed: (feed: FeedInfo) => void
  onStatusChange: (message: StatusMessage | null) => void
}) {
  const [feeds, setFeeds] = useState<FeedInfo[]>()
  const [error, setError] = useState<string>()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchSavedFeeds(client)
      .then((result) => {
        if (cancelled) return
        setFeeds(result)
        setError(undefined)
      })
      .catch(() => {
        if (!cancelled) setError('接続エラー — rで再試行')
      })
    return () => {
      cancelled = true
    }
  }, [client])

  useStatusMessage(
    onStatusChange,
    !feeds ? '読み込み中...' : feeds.length === 0 ? '保存済みフィードがありません' : undefined,
    error,
  )

  useInput(
    (input, key) => {
      if (error) {
        if (input === 'r') {
          setError(undefined)
          setFeeds(undefined)
        }
        return
      }
      if (!feeds || feeds.length === 0) return
      const nav = resolveListNavigation(input, key)
      if (nav === 'down') {
        setIndex((i) => Math.min(feeds.length - 1, i + 1))
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
        setIndex(feeds.length - 1)
        return
      }
      if (key.return) {
        const feed = feeds[index]
        if (feed) onOpenFeed(feed)
      }
    },
    { isActive: active },
  )

  if (error) {
    return <Box flexDirection="column" />
  }

  if (!feeds) {
    return <Box flexDirection="column" />
  }

  if (feeds.length === 0) {
    return <Box flexDirection="column" />
  }

  return (
    <Box flexDirection="column">
      {feeds.map((feed, i) => (
        <Box
          key={feed.uri}
          flexDirection="column"
          borderStyle="single"
          borderTop={false}
          borderRight={false}
          borderLeft
          borderLeftColor={i === index ? 'cyan' : 'gray'}
          paddingLeft={1}
        >
          <Box>
            {feed.pinned && <Text color="yellow">[pin] </Text>}
            <Text bold={i === index}>{feed.displayName}</Text>
          </Box>
          <Text color="#666666">by {feed.creatorDisplayName ?? `@${feed.creatorHandle}`}</Text>
          {feed.description && <Text>{feed.description}</Text>}
        </Box>
      ))}
    </Box>
  )
}
