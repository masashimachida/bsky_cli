import React from 'react'
import { Box, Text } from 'ink'
import { PostImages } from './PostImages.js'
import { formatRelativeTime } from '../api/format.js'
import type { PostSummary } from '../api/types.js'

export function PostItem({
  post,
  selected,
  expanded,
  repostedByHandle,
  replyToHandle,
  connectsToNext,
  indent,
  showThreadHint,
  replyIndent = true,
  showReplyMarker = true,
}: {
  post: PostSummary
  selected: boolean
  expanded: boolean
  repostedByHandle?: string
  replyToHandle?: string
  connectsToNext?: boolean
  indent?: boolean
  showThreadHint?: boolean
  // NotificationsScreenでは「返信」通知であること自体はマーカーで既に分かるため、
  // TimelineScreen等のスレッド文脈表示のような追加インデントは不要。falseで抑制する。
  replyIndent?: boolean
  // TimelineScreenでは、返信先がroot自身への直接返信の場合しか判定できず、
  // 深い連鎖では表示されたりされなかったりして不揃いになるため、マーカー自体を出さない。
  // インデント(showsReplyIndent)自体は文脈表示として維持する。
  showReplyMarker?: boolean
}) {
  const showsReplyIndent = !!replyToHandle && !repostedByHandle && replyIndent
  return (
    <Box
      flexDirection="column"
      width="100%"
      borderStyle="single"
      borderTop={false}
      borderRight={false}
      borderBottom={!connectsToNext}
      borderLeft={true}
      borderBottomColor="gray"
      borderLeftColor={selected ? 'cyan' : 'gray'}
      paddingLeft={showsReplyIndent || indent ? 2 : 1}
      paddingRight={3}
    >
      {repostedByHandle && <Text color="#666666">@{repostedByHandle} がリポスト</Text>}
      {replyToHandle && showReplyMarker && <Text color="#666666">↳ @{replyToHandle} への返信</Text>}
      <Box flexDirection="column" paddingLeft={showsReplyIndent || indent ? 2 : 0}>
        <Box>
          <Text bold color="yellow">{post.author.displayName ?? post.author.handle}</Text>
          <Text color="#666666"> · {formatRelativeTime(post.createdAt)}</Text>
        </Box>
        <Text>{post.text}</Text>
        <PostImages images={post.images} expanded={expanded} />
        {post.hasVideo && <Text color="#666666">[動画: oキーでブラウザから再生]</Text>}
        {post.quotedPost?.status === 'available' && (
          <Box borderStyle="round" borderColor="#666666" paddingX={1} flexDirection="column">
            <Box>
              <Text bold>{post.quotedPost.author.displayName ?? post.quotedPost.author.handle}</Text>
              <Text color="#666666"> @{post.quotedPost.author.handle}</Text>
              <Text color="#666666"> · {formatRelativeTime(post.quotedPost.createdAt)}</Text>
            </Box>
            <Text>{post.quotedPost.text}</Text>
          </Box>
        )}
        {post.quotedPost?.status === 'not-found' && (
          <Box borderStyle="round" borderColor="#666666" paddingX={1}>
            <Text color="#666666">(元の投稿は削除されています)</Text>
          </Box>
        )}
        {post.quotedPost?.status === 'blocked' && (
          <Box borderStyle="round" borderColor="#666666" paddingX={1}>
            <Text color="#666666">(ブロックにより表示できません)</Text>
          </Box>
        )}
        {post.quotedPost?.status === 'detached' && (
          <Box borderStyle="round" borderColor="#666666" paddingX={1}>
            <Text color="#666666">(投稿者がこの引用を削除しました)</Text>
          </Box>
        )}
        <Box gap={2}>
          <Text color={post.viewerLikeUri ? 'magenta' : undefined}>{post.viewerLikeUri ? '♥' : '♡'} {post.likeCount}</Text>
          <Text color={post.viewerRepostUri ? 'green' : undefined}>↻ {post.repostCount}</Text>
          <Text>↩ {post.replyCount}</Text>
        </Box>
        {showThreadHint && (
          <Box paddingLeft={3}>
            <Text color="#666666">スレッドをすべて表示</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}
