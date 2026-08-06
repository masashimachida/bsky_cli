import { describe, expect, it } from 'vitest'
import { cursorOffset } from './cursor-offset.js'

describe('cursorOffset', () => {
  it('折返し不要な短いテキストの末尾はそのまま1行目', () => {
    expect(cursorOffset('abc', 3, 56)).toEqual({ x: 3, y: 0 })
  })

  it('カーソルが先頭(0)なら{x:0, y:0}', () => {
    expect(cursorOffset('abc', 0, 56)).toEqual({ x: 0, y: 0 })
  })

  it('論理改行(\\n)の後ろにカーソルがあれば2行目として計算する', () => {
    expect(cursorOffset('abc\ndef', 7, 56)).toEqual({ x: 3, y: 1 })
  })

  it('maxWidthを超える長さのテキストは自動折返しされた行数をyに反映する', () => {
    const value = '0'.repeat(74)
    // maxWidth=56で74文字を折り返すと1行目56文字+2行目18文字になる(wrap-ansiのhard wrap)
    expect(cursorOffset(value, 74, 56)).toEqual({ x: 18, y: 1 })
  })

  it('自動折返し後さらに論理改行を挟んだ場合、折返し分もyに加算される', () => {
    // 74文字(自動折返しで2行) + \n + 3文字 = カーソルは4行目相当(y=3)
    const value = '0'.repeat(74) + '\nXYZ'
    expect(cursorOffset(value, value.length, 56)).toEqual({ x: 3, y: 2 })
  })
})
