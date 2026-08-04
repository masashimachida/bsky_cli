import { describe, expect, it, vi } from 'vitest'
import { createKeychainSessionStore, type KeyringEntry } from './session-store.js'

function fakeEntry(overrides: Partial<KeyringEntry> = {}): KeyringEntry {
  return {
    setPassword: vi.fn(),
    getPassword: vi.fn(() => {
      throw new Error('no entry')
    }),
    deletePassword: vi.fn(),
    ...overrides,
  }
}

describe('createKeychainSessionStore', () => {
  it('saveはJSON文字列化してsetPasswordを呼ぶ', () => {
    const entry = fakeEntry()
    const store = createKeychainSessionStore(() => entry)
    store.save({
      session: { accessJwt: 'a', refreshJwt: 'b', handle: 'x.bsky.social', did: 'did:plc:1', active: true } as never,
      serviceUrl: 'https://bsky.social',
    })
    expect(entry.setPassword).toHaveBeenCalledWith(
      JSON.stringify({
        session: { accessJwt: 'a', refreshJwt: 'b', handle: 'x.bsky.social', did: 'did:plc:1', active: true },
        serviceUrl: 'https://bsky.social',
      }),
    )
  })

  it('loadは保存済みJSONをパースして返す', () => {
    const saved = {
      session: { accessJwt: 'a', refreshJwt: 'b', handle: 'x.bsky.social', did: 'did:plc:1', active: true },
      serviceUrl: 'https://bsky.social',
    }
    const entry = fakeEntry({ getPassword: vi.fn(() => JSON.stringify(saved)) })
    const store = createKeychainSessionStore(() => entry)
    expect(store.load()).toEqual(saved)
  })

  it('未保存の場合loadはnullを返す（例外を握りつぶす）', () => {
    const store = createKeychainSessionStore(() => fakeEntry())
    expect(store.load()).toBeNull()
  })

  it('旧形式(serviceUrlフィールドが無いAtpSessionDataそのまま)のデータはloadでnullを返す', () => {
    const legacyData = { accessJwt: 'a', refreshJwt: 'b', handle: 'x.bsky.social', did: 'did:plc:1', active: true }
    const entry = fakeEntry({ getPassword: vi.fn(() => JSON.stringify(legacyData)) })
    const store = createKeychainSessionStore(() => entry)
    expect(store.load()).toBeNull()
  })

  it('clearはdeletePasswordを呼び、例外があっても投げない', () => {
    const entry = fakeEntry({
      deletePassword: vi.fn(() => {
        throw new Error('not found')
      }),
    })
    const store = createKeychainSessionStore(() => entry)
    expect(() => store.clear()).not.toThrow()
    expect(entry.deletePassword).toHaveBeenCalled()
  })
})
