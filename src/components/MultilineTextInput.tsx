import React, { useLayoutEffect, useReducer, useRef, useState } from 'react'
import { Box, Text, useInput, useCursor, measureElement } from 'ink'
import type { DOMElement } from 'ink'
import { cursorOffset } from './cursor-offset.js'
import { textBufferReducer, initialTextBufferState } from './text-buffer.js'

const BORDER_ROWS = 1 // paddingXは横方向のみなので、上枠1行分だけ考慮すればよい
const BORDER_LEFT = 1 // 左枠線(│)の1列分
const BORDER_RIGHT = 1 // 右枠線(│)の1列分
const PADDING_X = 1

export function MultilineTextInput({
  onSubmit,
  onCancel,
  active,
}: {
  onSubmit: (text: string) => void
  onCancel: () => void
  active: boolean
}) {
  const [state, dispatch] = useReducer(textBufferReducer, initialTextBufferState)
  const { setCursorPosition } = useCursor()
  const boxRef = useRef<DOMElement>(null)
  const [box, setBox] = useState<{ x: number; y: number; width: number } | null>(null)

  // Boxの絶対位置とテキスト折返し計算に必要な幅は、親要素の構成が変わらない限り
  // 一定なので、測定できたらstateにキャッシュする。measureElementはレンダー後
  // (post-render)でないと正確な値を返さないため、useLayoutEffectで測定する。
  useLayoutEffect(() => {
    if (!boxRef.current) return
    const { x, y, width } = measureElement(boxRef.current)
    setBox((prev) => (prev && prev.x === x && prev.y === y && prev.width === width ? prev : { x, y, width }))
  })

  // setCursorPositionはレンダー中に呼ぶ設計(内部でuseInsertionEffectに反映
  // タイミングを委ねている)のため、post-renderのuseLayoutEffect内では呼ばない。
  // boxが確定していれば、その場でカーソルの絶対位置を計算できる。
  if (active && box) {
    // <Text>はBox幅を超えると自動折返しされるため、テキスト折返し計算にも同じ利用可能幅を渡す
    // (でないとcursorOffsetが自動折返しによる追加行を認識できずカーソル位置がズレる)。
    const availableWidth = Math.max(1, box.width - BORDER_LEFT - BORDER_RIGHT - PADDING_X * 2)
    const offset = cursorOffset(state.value, state.cursor, availableWidth)
    setCursorPosition({ x: box.x + offset.x + BORDER_LEFT + PADDING_X, y: box.y + offset.y + BORDER_ROWS })
  } else {
    setCursorPosition(undefined)
  }

  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel()
        return
      }
      if (key.return && key.meta) {
        dispatch({ type: 'insert', text: '\n' })
        return
      }
      if (key.return) {
        onSubmit(state.value)
        return
      }
      if (key.backspace || key.delete) {
        dispatch({ type: 'backspace' })
        return
      }
      if (key.leftArrow) {
        dispatch({ type: 'move-left' })
        return
      }
      if (key.rightArrow) {
        dispatch({ type: 'move-right' })
        return
      }
      if (input) {
        dispatch({ type: 'insert', text: input })
      }
    },
    { isActive: active },
  )

  return (
    <Box ref={boxRef} borderStyle="round" paddingX={1} flexDirection="column">
      <Text>{state.value || ' '}</Text>
      <Text dimColor>{state.value.length}/300文字 Enter:投稿 Alt+Enter:改行 Esc:キャンセル</Text>
    </Box>
  )
}
