import React, { useLayoutEffect, useRef, useState } from 'react'
import { Box, measureElement } from 'ink'
import type { DOMElement } from 'ink'

// HeaderBar分(枠無し1行) + HeaderBar直後の空行(1) + StatusBar分(上枠+本文+下枠=3) + ターミナル行数ぴったりを避ける安全マージン(1)
export const OVERHEAD_ROWS = 6
const SCROLLOFF = 1
const MAX_RENDER_COUNT = 40 // 描画件数の安全上限(見積もりではない)

export function ScrollingViewport<T>({
  items,
  selectedIndex,
  availableRows,
  isSelectedExpanded,
  getKey,
  renderItem,
}: {
  items: T[]
  selectedIndex: number
  availableRows: number
  isSelectedExpanded: boolean
  getKey: (item: T) => string
  renderItem: (item: T, selected: boolean) => React.ReactNode
}) {
  const [viewStart, setViewStart] = useState(0)
  const targetRef = useRef<DOMElement>(null)

  const clampedViewStart = Math.min(viewStart, Math.max(0, selectedIndex - SCROLLOFF))
  const targetIndex = selectedIndex + SCROLLOFF

  useLayoutEffect(() => {
    if (clampedViewStart < viewStart) {
      setViewStart(clampedViewStart)
      return
    }
    if (targetIndex >= items.length) return
    if (!targetRef.current) return
    const m = measureElement(targetRef.current)
    if (m.height === 0 || m.y + m.height > availableRows) {
      setViewStart((v) => v + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, clampedViewStart, availableRows, items.length, isSelectedExpanded])

  const visible = items.slice(clampedViewStart, clampedViewStart + MAX_RENDER_COUNT)

  return (
    <Box flexDirection="column" height={availableRows} overflowY="hidden">
      {visible.map((item, offset) => {
        const i = clampedViewStart + offset
        return (
          <Box key={getKey(item)} flexShrink={0} ref={i === targetIndex ? targetRef : undefined}>
            {renderItem(item, i === selectedIndex)}
          </Box>
        )
      })}
    </Box>
  )
}
