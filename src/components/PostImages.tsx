import React from 'react'
import { Box, Text, useStdout } from 'ink'
import Image from 'ink-picture'
import type { ImageAttachment } from '../api/types.js'

const MAX_THUMB_WIDTH = 30
const THUMB_HEIGHT = 12
const GAP = 1
const HORIZONTAL_MARGIN = 8

export function PostImages({ images, expanded }: { images: ImageAttachment[]; expanded: boolean }) {
  const { stdout } = useStdout()
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
      {images.map((img, i) => (
        <Box key={`${i}-${img.thumbUrl}`} width={widthPerImage} height={THUMB_HEIGHT}>
          <Image
            src={img.thumbUrl}
            width={widthPerImage}
            height={THUMB_HEIGHT}
            objectFit="cover"
            alt={img.alt.replace(/\s*\n+\s*/g, ' ').trim()}
            protocol="kitty"
          />
        </Box>
      ))}
    </Box>
  )
}
