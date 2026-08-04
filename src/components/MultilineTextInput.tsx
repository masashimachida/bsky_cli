import React, { useLayoutEffect, useReducer, useRef, useState } from 'react'
import { Box, Text, useInput, useCursor, measureElement } from 'ink'
import type { DOMElement } from 'ink'
import stringWidth from 'string-width'
import { textBufferReducer, initialTextBufferState } from './text-buffer.js'

const BORDER_ROWS = 1 // paddingXは横方向のみなので、上枠1行分だけ考慮すればよい
const BORDER_LEFT = 1 // 左枠線(│)の1列分
const PADDING_X = 1

function cursorOffset(value: string, cursor: number): { x: number; y: number } {
  const before = value.slice(0, cursor)
  const lines = before.split('\n')
  const y = lines.length - 1
  const x = stringWidth(lines[lines.length - 1])
  return { x: x + BORDER_LEFT + PADDING_X, y: y + BORDER_ROWS }
}

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
  const [boxPosition, setBoxPosition] = useState<{ x: number; y: number } | null>(null)

  // Boxの絶対位置(アプリ全体の座標系での位置)は、親要素の構成が変わらない限り
  // 一定なので、測定できたらstateにキャッシュする。measureElementはレンダー後
  // (post-render)でないと正確な値を返さないため、useLayoutEffectで測定する。
  useLayoutEffect(() => {
    if (!boxRef.current) return
    const { x, y } = measureElement(boxRef.current)
    setBoxPosition((prev) => (prev && prev.x === x && prev.y === y ? prev : { x, y }))
  })

  // setCursorPositionはレンダー中に呼ぶ設計(内部でuseInsertionEffectに反映
  // タイミングを委ねている)のため、post-renderのuseLayoutEffect内では呼ばない。
  // boxPositionが確定していれば、その場でカーソルの絶対位置を計算できる。
  if (active && boxPosition) {
    const offset = cursorOffset(state.value, state.cursor)
    setCursorPosition({ x: boxPosition.x + offset.x, y: boxPosition.y + offset.y })
  } else {
    setCursorPosition(undefined)
  }

  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel()
        return
      }
      if (key.return && (key.shift || key.meta)) {
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
      <Text dimColor>{state.value.length}/300文字 Enter:投稿 Shift+Enter:改行 Esc:キャンセル</Text>
    </Box>
  )
}
