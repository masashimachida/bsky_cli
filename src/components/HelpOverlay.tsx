import React from 'react'
import { Box, Text } from 'ink'

const ROWS: Array<[string, string]> = [
  ['j / k', '下 / 上に移動'],
  ['g / G', '先頭 / 末尾へ'],
  ['Enter', 'スレッドを開く'],
  ['Esc / h', '戻る'],
  ['1 / 2 / 4', 'タイムライン / 通知 / プロフィール切替'],
  ['f', 'いいね'],
  ['R', 'リポスト'],
  ['r', '返信'],
  ['q', '引用リポスト'],
  ['u', '投稿者のプロフィールを開く'],
  ['d', '自分の投稿を削除'],
  ['o', '外部リンクカードをブラウザで開く'],
  ['O', '投稿をブラウザで開く'],
  ['n', '新規投稿'],
  ['Ctrl+C', '終了'],
  ['Q', 'ログアウト'],
]

export function HelpOverlay() {
  return (
    <Box flexDirection="column" borderStyle="double" padding={1}>
      <Text bold>キー操作一覧</Text>
      {ROWS.map(([key, desc]) => (
        <Box key={key} gap={1}>
          <Box width={10}>
            <Text color="cyan">{key}</Text>
          </Box>
          <Text>{desc}</Text>
        </Box>
      ))}
      <Text dimColor>任意のキーで閉じる</Text>
    </Box>
  )
}
