import React from 'react'
import { Box } from 'ink'

// アイコン画像表示は一時的に無効化している。
// 画像コンポーネントの直接stdout書き込みとInkのテキスト再描画が競合し、
// 本文の一部が消えたり文字が欠けたりする不具合の原因調査のため。
// 投稿本文中の画像(PostImages)は対象外、そちらは引き続き表示する。
export function Avatar({ url: _url }: { url?: string }) {
  return <Box width={3} height={1} marginRight={1} />
}
