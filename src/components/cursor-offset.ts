import wrapAnsi from 'wrap-ansi'
import stringWidth from 'string-width'

// Inkの<Text>コンポーネント(wrap='wrap'、内部ではwrap-ansiを{trim:false, hard:true}で
// 使用)による自動折返しを考慮してカーソル位置を計算する。value中の論理改行(\n)の数だけで
// y座標を計算すると、maxWidthを超えて自動折返しされた行がカウントされずズレる
// (例: 長い1行が画面上2行に折り返されても、\nが無いためy=0のまま計算されてしまう)。
export function cursorOffset(value: string, cursor: number, maxWidth: number): { x: number; y: number } {
  const before = value.slice(0, cursor)
  const wrapped = maxWidth > 0 ? wrapAnsi(before, maxWidth, { trim: false, hard: true }) : before
  const lines = wrapped.split('\n')
  const y = lines.length - 1
  const x = stringWidth(lines[lines.length - 1])
  return { x, y }
}
