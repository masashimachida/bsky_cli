import React, { useState } from 'react'
import { Box, Text } from 'ink'
import { MultilineTextInput } from '../components/MultilineTextInput.js'
import { StatusBar } from '../components/StatusBar.js'
import { createPost } from '../api/client.js'
import type { AtpClient } from '../api/atp-client.js'

export interface ComposeReplyTarget {
  root: { uri: string; cid: string }
  parent: { uri: string; cid: string }
}

export function ComposeScreen({
  client,
  replyTo,
  onDone,
  onCancel,
}: {
  client: AtpClient
  replyTo?: ComposeReplyTarget
  onDone: () => void
  onCancel: () => void
}) {
  const [error, setError] = useState<string>()
  const [posting, setPosting] = useState(false)

  async function handleSubmit(text: string) {
    const trimmed = text.trim()
    if (!trimmed) {
      setError('本文が空です')
      return
    }
    setPosting(true)
    setError(undefined)
    try {
      await createPost(client, trimmed, replyTo)
      onDone()
    } catch {
      setError('投稿に失敗しました — 入力内容は保持されています')
      setPosting(false)
    }
  }

  return (
    <Box flexDirection="column">
      <Text bold>{replyTo ? '返信を作成' : '新規投稿'}</Text>
      <MultilineTextInput active={!posting} onSubmit={handleSubmit} onCancel={onCancel} />
      <StatusBar hint="Enter: 投稿 / Alt+Enter: 改行 / Esc: キャンセル" status={posting ? '投稿中...' : undefined} error={error} />
    </Box>
  )
}
