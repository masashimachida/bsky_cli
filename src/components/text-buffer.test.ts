import { describe, expect, it } from 'vitest'
import { textBufferReducer, initialTextBufferState } from './text-buffer.js'

describe('textBufferReducer', () => {
  it('insertはカーソル位置に文字列を挿入しカーソルを進める', () => {
    const s1 = textBufferReducer(initialTextBufferState, { type: 'insert', text: 'abc' })
    expect(s1).toEqual({ value: 'abc', cursor: 3 })
    const s2 = textBufferReducer({ value: 'ac', cursor: 1 }, { type: 'insert', text: 'b' })
    expect(s2).toEqual({ value: 'abc', cursor: 2 })
  })

  it('backspaceはカーソル直前の1文字を削除する', () => {
    const s = textBufferReducer({ value: 'abc', cursor: 2 }, { type: 'backspace' })
    expect(s).toEqual({ value: 'ac', cursor: 1 })
  })

  it('カーソル0でbackspaceしても変化しない', () => {
    const s = textBufferReducer({ value: 'abc', cursor: 0 }, { type: 'backspace' })
    expect(s).toEqual({ value: 'abc', cursor: 0 })
  })

  it('move-left/move-rightは範囲内でカーソルを動かす', () => {
    expect(textBufferReducer({ value: 'abc', cursor: 1 }, { type: 'move-left' }).cursor).toBe(0)
    expect(textBufferReducer({ value: 'abc', cursor: 0 }, { type: 'move-left' }).cursor).toBe(0)
    expect(textBufferReducer({ value: 'abc', cursor: 2 }, { type: 'move-right' }).cursor).toBe(3)
    expect(textBufferReducer({ value: 'abc', cursor: 3 }, { type: 'move-right' }).cursor).toBe(3)
  })
})
