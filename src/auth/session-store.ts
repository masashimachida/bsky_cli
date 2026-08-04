import { Entry } from '@napi-rs/keyring'
import type { AtpSessionData } from '@atproto/api'

const SERVICE = 'bsky-cli'
const ACCOUNT = 'session'

export interface KeyringEntry {
  setPassword(password: string): void
  getPassword(): string | null
  deletePassword(): boolean
}

export type EntryFactory = () => KeyringEntry

const defaultEntryFactory: EntryFactory = () => new Entry(SERVICE, ACCOUNT)

export interface StoredSession {
  session: AtpSessionData
  serviceUrl: string
}

// 旧形式(AtpSessionDataをそのまま保存していたバージョン)のデータを誤って
// StoredSessionとして扱うとnew URL(undefined)で例外になるため、形を検証する。
function isStoredSession(value: unknown): value is StoredSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    'session' in value &&
    'serviceUrl' in value &&
    typeof (value as { serviceUrl: unknown }).serviceUrl === 'string'
  )
}

export interface SessionStore {
  save(data: StoredSession): void
  load(): StoredSession | null
  clear(): void
}

export function createKeychainSessionStore(entryFactory: EntryFactory = defaultEntryFactory): SessionStore {
  return {
    save(data) {
      entryFactory().setPassword(JSON.stringify(data))
    },
    load() {
      try {
        const raw = entryFactory().getPassword()
        if (raw === null) return null
        const parsed: unknown = JSON.parse(raw)
        return isStoredSession(parsed) ? parsed : null
      } catch {
        return null
      }
    },
    clear() {
      try {
        entryFactory().deletePassword()
      } catch {
        // 既に存在しない場合は無視
      }
    },
  }
}
