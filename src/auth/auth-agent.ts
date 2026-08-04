import { Agent, CredentialSession, type AtpSessionData } from '@atproto/api'
import type { SessionStore } from './session-store.js'

export const DEFAULT_SERVICE_URL = 'https://bsky.social'

type SessionEvent = 'create' | 'create-failed' | 'update' | 'expired' | 'network-error'

type StoreAction = { action: 'save'; session: AtpSessionData } | { action: 'clear' } | { action: 'noop' }

export function sessionEventToStoreAction(event: SessionEvent, session: AtpSessionData | undefined): StoreAction {
  if ((event === 'create' || event === 'update') && session) {
    return { action: 'save', session }
  }
  if (event === 'expired') {
    return { action: 'clear' }
  }
  return { action: 'noop' }
}

export function createAuthSession(serviceUrl: string, store: SessionStore, onExpired?: () => void): CredentialSession {
  return new CredentialSession(new URL(serviceUrl), globalThis.fetch, (event, session) => {
    const result = sessionEventToStoreAction(event, session)
    if (result.action === 'save') store.save({ session: result.session, serviceUrl })
    if (result.action === 'clear') {
      store.clear()
      onExpired?.()
    }
  })
}

export async function loginWithAppPassword(
  session: CredentialSession,
  identifier: string,
  password: string,
): Promise<Agent> {
  await session.login({ identifier, password })
  return new Agent(session)
}

export async function resumeAgent(session: CredentialSession, saved: AtpSessionData): Promise<Agent> {
  await session.resumeSession(saved)
  return new Agent(session)
}
