import { describe, expect, it } from 'vitest'
import { isSafeExternalUrl, sanitizeText } from './sanitize.js'

describe('sanitizeText', () => {
  it('ESC(制御文字)を除去する', () => {
    // ESC自体を除去すれば、後続の"[31m"はエスケープシーケンスとして機能しなくなる
    expect(sanitizeText('hello\x1b[31mworld')).toBe('hello[31mworld')
  })

  it('改行・タブ・復帰は保持する', () => {
    expect(sanitizeText('line1\nline2\ttab\rend')).toBe('line1\nline2\ttab\rend')
  })

  it('C1制御文字を除去する', () => {
    expect(sanitizeText('a\x9bb')).toBe('ab')
  })

  it('制御文字を含まない文字列はそのまま返す', () => {
    expect(sanitizeText('普通のテキスト 123')).toBe('普通のテキスト 123')
  })
})

describe('isSafeExternalUrl', () => {
  it('httpは許可する', () => {
    expect(isSafeExternalUrl('http://example.com')).toBe(true)
  })

  it('httpsは許可する', () => {
    expect(isSafeExternalUrl('https://example.com/path')).toBe(true)
  })

  it('file:は拒否する', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false)
  })

  it('smb:は拒否する', () => {
    expect(isSafeExternalUrl('smb://evil.example/share')).toBe(false)
  })

  it('パース不能な文字列は拒否する', () => {
    expect(isSafeExternalUrl('not a url')).toBe(false)
  })
})
