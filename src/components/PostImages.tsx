import React, { useRef } from 'react'
import { Box, Text, useStdout } from 'ink'
import Image, { useTerminalInfo } from 'ink-picture'
import { calculateImageHeight } from './image-size.js'
import type { ImageAttachment } from '../api/types.js'

const MAX_THUMB_WIDTH = 30
const THUMB_HEIGHT = 12
const MIN_THUMB_HEIGHT = 4
const MAX_THUMB_HEIGHT = 20
const GAP = 1
const HORIZONTAL_MARGIN = 8

export function PostImages({ images, expanded }: { images: ImageAttachment[]; expanded: boolean }) {
  const { stdout } = useStdout()
  const terminalInfo = useTerminalInfo()
  // ink-pictureのuseTerminalInfoは初回defaultTerminalInfoを返し、非同期のターミナル
  // 問い合わせ完了後に実測値へ更新される。この値の変化でBox高さが変わると、Kitty画像の
  // 配置(位置計算)が複数回異なる高さで実行され、描画がずれて重なる不具合が起きるため、
  // 画像ごとに一度計算した高さをキャッシュし、以降のterminalInfo変化では再計算しない。
  const heightCacheRef = useRef<Map<string, number>>(new Map())
  if (images.length === 0) return null
  if (!expanded) return <Text dimColor>{Array(images.length).fill('🖼️').join(' ')}</Text>

  const columns = stdout.columns || 80
  const availableWidth = columns - HORIZONTAL_MARGIN
  const widthPerImage = Math.max(
    5,
    Math.min(MAX_THUMB_WIDTH, Math.floor((availableWidth - GAP * (images.length - 1)) / images.length)),
  )

  return (
    <Box gap={GAP}>
      {images.map((img, i) => {
        const cacheKey = `${img.thumbUrl}-${widthPerImage}`
        let height = heightCacheRef.current.get(cacheKey)
        if (height === undefined) {
          height = calculateImageHeight(
            widthPerImage,
            img.aspectRatio,
            terminalInfo.cellWidth,
            terminalInfo.cellHeight,
            THUMB_HEIGHT,
            MIN_THUMB_HEIGHT,
            MAX_THUMB_HEIGHT,
          )
          heightCacheRef.current.set(cacheKey, height)
        }
        return (
          <Box key={`${i}-${img.thumbUrl}`} width={widthPerImage} height={height}>
            <Image
              src={img.thumbUrl}
              width={widthPerImage}
              height={height}
              objectFit="contain"
              alt={img.alt.replace(/\s*\n+\s*/g, ' ').trim()}
              protocol="kitty"
            />
          </Box>
        )
      })}
    </Box>
  )
}
