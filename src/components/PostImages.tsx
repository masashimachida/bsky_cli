import React from 'react'
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
