import { describe, expect, it } from 'vitest'
import { screenStackReducer, initialScreenStackState } from './screen-stack.js'

describe('screenStackReducer', () => {
  it('初期状態はloginのみ', () => {
    expect(initialScreenStackState.stack).toEqual([{ name: 'login' }])
  })

  it('pushでスタックに積む', () => {
    const state = screenStackReducer(initialScreenStackState, { type: 'push', screen: { name: 'timeline' } })
    expect(state.stack).toEqual([{ name: 'login' }, { name: 'timeline' }])
  })

  it('popで末尾を取り除く（1件のみのときは変化しない）', () => {
    const two = { stack: [{ name: 'timeline' as const }, { name: 'thread' as const, uri: 'u' }] }
    expect(screenStackReducer(two, { type: 'pop' }).stack).toEqual([{ name: 'timeline' }])
    expect(screenStackReducer(initialScreenStackState, { type: 'pop' }).stack).toEqual(initialScreenStackState.stack)
  })

  it('resetでスタック全体を1件に置き換える', () => {
    const three = { stack: [{ name: 'timeline' as const }, { name: 'thread' as const, uri: 'u' }, { name: 'compose' as const }] }
    const state = screenStackReducer(three, { type: 'reset', screen: { name: 'notifications' } })
    expect(state.stack).toEqual([{ name: 'notifications' }])
  })

  it('pushでimage-view screenも積める', () => {
    const state = screenStackReducer(initialScreenStackState, {
      type: 'push',
      screen: {
        name: 'image-view',
        images: [{ thumbUrl: 't', fullsizeUrl: 'f', alt: 'a' }],
        initialIndex: 0,
      },
    })
    expect(state.stack).toEqual([
      { name: 'login' },
      { name: 'image-view', images: [{ thumbUrl: 't', fullsizeUrl: 'f', alt: 'a' }], initialIndex: 0 },
    ])
  })
})
