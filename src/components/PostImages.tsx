import React, { useEffect, useState } from 'react'
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
  // expandedがfalseになった瞬間に<Image>を即座にアンマウントすると、ink-pictureの
  // 直接stdout書き込み(useDirectRenderer)によるクリーンアップがInkの通常描画パイプラインと
  // タイミング競合し、画像が消えずに残ってしまうことがある(WezTerm/iterm2プロトコルの既知の
  // 制約)。アンマウントを1ティック(setTimeout 0ms)遅らせ、Reactの通常コミットサイクルの
  // 外側でクリーンアップを実行させることで競合を避ける。呼び出し元(選択移動・画面遷移等)を
  // 個別に意識せず、画像コンポーネント側だけで完結する対策にするため、ここに置く。
  const [mounted, setMounted] = useState(expanded)
  useEffect(() => {
    if (expanded) {
      setMounted(true)
      return
    }
    const timer = setTimeout(() => setMounted(false), 0)
    return () => clearTimeout(timer)
  }, [expanded])

  if (images.length === 0) return null
  if (!mounted) return <Text dimColor>{Array(images.length).fill('🖼️').join(' ')}</Text>

  const columns = stdout.columns || 80
  const availableWidth = columns - HORIZONTAL_MARGIN
  const widthPerImage = Math.max(
    5,
    Math.min(MAX_THUMB_WIDTH, Math.floor((availableWidth - GAP * (images.length - 1)) / images.length)),
  )

  return (
    <Box gap={GAP}>
      {images.map((img, i) => {
        const height = calculateImageHeight(
          widthPerImage,
          img.aspectRatio,
          terminalInfo.cellWidth,
          terminalInfo.cellHeight,
          THUMB_HEIGHT,
          MIN_THUMB_HEIGHT,
          MAX_THUMB_HEIGHT,
        )
        return (
          <Box key={`${i}-${img.thumbUrl}`} width={widthPerImage} height={height}>
            <Image
              src={img.thumbUrl}
              width={widthPerImage}
              height={height}
              objectFit="contain"
              alt={img.alt.replace(/\s*\n+\s*/g, ' ').trim()}
            />
          </Box>
        )
      })}
    </Box>
  )
}
