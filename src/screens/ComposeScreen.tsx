import React, { useState } from 'react'
import { Box, Text } from 'ink'
import { MultilineTextInput } from '../components/MultilineTextInput.js'
import { createPost } from '../api/client.js'
import { useStatusMessage } from '../navigation/useStatusMessage.js'
import type { StatusMessage } from '../navigation/useStatusMessage.js'
import type { AtpClient } from '../api/atp-client.js'
import type { Author } from '../api/types.js'

export interface ComposeReplyTarget {
  root: { uri: string; cid: string }
  parent: { uri: string; cid: string }
}

export interface ComposeQuoteTarget {
  uri: string
  cid: string
  author: Author
  text: string
}

export function ComposeScreen({
  client,
  replyTo,
  quoteTarget,
  onDone,
  onCancel,
  onStatusChange,
}: {
  client: AtpClient
  replyTo?: ComposeReplyTarget
  quoteTarget?: ComposeQuoteTarget
  onDone: () => void
  onCancel: () => void
  onStatusChange: (message: StatusMessage | null) => void
}) {
  const [error, setError] = useState<string>()
  const [posting, setPosting] = useState(false)

  useStatusMessage(onStatusChange, posting ? '投稿中...' : undefined, error)

  async function handleSubmit(text: string) {
    const trimmed = text.trim()
    if (!trimmed) {
      setError('本文が空です')
      return
    }
    setPosting(true)
    setError(undefined)
    try {
      await createPost(client, trimmed, replyTo, quoteTarget ? { uri: quoteTarget.uri, cid: quoteTarget.cid } : undefined)
      onDone()
    } catch {
      setError('投稿に失敗しました — 入力内容は保持されています')
      setPosting(false)
    }
  }

  return (
    <Box flexDirection="column">
      <Text bold>{replyTo ? '返信を作成' : quoteTarget ? '引用リポストを作成' : '新規投稿'}</Text>
      {quoteTarget && (
        <Box borderStyle="round" borderColor="#666666" paddingX={1} flexDirection="column">
          <Box>
            <Text bold>{quoteTarget.author.displayName ?? quoteTarget.author.handle}</Text>
            <Text color="#666666"> @{quoteTarget.author.handle}</Text>
          </Box>
          <Text>{quoteTarget.text}</Text>
        </Box>
      )}
      <MultilineTextInput active={!posting} onSubmit={handleSubmit} onCancel={onCancel} />
    </Box>
  )
}
