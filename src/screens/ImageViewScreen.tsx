import React, { useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import Image from 'ink-picture'
import { StatusBar } from '../components/StatusBar.js'
import { resolveGlobalAction } from '../keymap/global-keymap.js'
import type { ImageAttachment } from '../api/types.js'

const STATUS_BAR_ROWS = 3 // top border + content + bottom border
const ALT_TEXT_ROWS = 1
const SAFETY_MARGIN_ROWS = 1

export function ImageViewScreen({
  images,
  initialIndex,
  onBack,
}: {
  images: ImageAttachment[]
  initialIndex: number
  onBack: () => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const { stdout } = useStdout()

  useInput((input, key) => {
    const action = resolveGlobalAction(input, key)
    if (action === 'back') {
      onBack()
      return
    }
    if (key.rightArrow) {
      setIndex((i) => Math.min(images.length - 1, i + 1))
      return
    }
    if (key.leftArrow) {
      setIndex((i) => Math.max(0, i - 1))
      return
    }
  })

  if (images.length === 0) return null

  const current = images[Math.min(Math.max(index, 0), images.length - 1)]
  const columns = stdout.columns || 80
  const rows = stdout.rows || 24
  const imageWidth = Math.max(10, columns - 4)
  const pageCounterRows = images.length > 1 ? 1 : 0
  const reservedRows = ALT_TEXT_ROWS + pageCounterRows + STATUS_BAR_ROWS + SAFETY_MARGIN_ROWS
  const imageHeight = Math.max(5, rows - reservedRows)
  // altテキストに改行が含まれる投稿がある(Blueskyのalt入力は複数行を許容)。
  // wrap="truncate"は横方向の切り詰めのみで改行自体は潰さないため、
  // 改行入りaltだとALT_TEXT_ROWSの想定(1行)を超えてレイアウトが崩れ、
  // ink-pictureのvisibility判定が"partial"になり画像が描画されなくなる。
  const displayAlt = current.alt.replace(/\s*\n+\s*/g, ' ').trim()

  return (
    <Box flexDirection="column">
      <Box width={imageWidth} height={imageHeight}>
        <Image
          src={current.fullsizeUrl}
          width={imageWidth}
          height={imageHeight}
          objectFit="contain"
          alt={displayAlt}
          protocol="kitty"
        />
      </Box>
      <Text dimColor wrap="truncate">{displayAlt}</Text>
      {images.length > 1 && (
        <Text dimColor>
          {index + 1}/{images.length}
        </Text>
      )}
      <StatusBar hint="←/→:画像切替 Esc/h:戻る" />
    </Box>
  )
}
