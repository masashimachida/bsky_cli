import { describe, expect, it } from 'vitest'
import { resolveListNavigation } from './vim-list-keymap.js'
import { resolveGlobalAction } from './global-keymap.js'
import type { InkKey } from './types.js'

const NO_KEY: InkKey = {
  upArrow: false,
  downArrow: false,
  leftArrow: false,
  rightArrow: false,
  return: false,
  escape: false,
  ctrl: false,
  shift: false,
  meta: false,
  tab: false,
  backspace: false,
  delete: false,
}

describe('resolveListNavigation', () => {
  it.each([
    ['j', 'down'],
    ['k', 'up'],
    ['g', 'top'],
    ['G', 'bottom'],
  ])('%s -> %s', (input, expected) => {
    expect(resolveListNavigation(input, NO_KEY)).toBe(expected)
  })

  it('downArrowキーもdownとして扱う', () => {
    expect(resolveListNavigation('', { ...NO_KEY, downArrow: true })).toBe('down')
  })

  it('該当しない入力はnull', () => {
    expect(resolveListNavigation('x', NO_KEY)).toBeNull()
  })
})

describe('resolveGlobalAction', () => {
  it.each([
    ['?', 'help'],
    ['q', 'quit'],
    ['h', 'back'],
    ['1', 'switch-timeline'],
    ['2', 'switch-notifications'],
    ['3', 'switch-search'],
    ['4', 'switch-profile'],
    ['f', 'like'],
    ['R', 'repost'],
    ['r', 'reply'],
    ['n', 'compose'],
    ['o', 'open-link'],
    ['O', 'open-post'],
    ['i', 'view-image'],
    ['u', 'view-author'],
    ['d', 'delete'],
  ])('%s -> %s', (input, expected) => {
    expect(resolveGlobalAction(input, NO_KEY)).toBe(expected)
  })

  it('Escapeキーはbackになる', () => {
    expect(resolveGlobalAction('', { ...NO_KEY, escape: true })).toBe('back')
  })

  it('Enterはopen-threadになる', () => {
    expect(resolveGlobalAction('', { ...NO_KEY, return: true })).toBe('open-thread')
  })

  it('該当しない入力はnull', () => {
    expect(resolveGlobalAction('z', NO_KEY)).toBeNull()
  })
})
