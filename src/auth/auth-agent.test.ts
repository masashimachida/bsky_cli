import { describe, expect, it } from 'vitest'
import { sessionEventToStoreAction } from './auth-agent.js'

const session = { accessJwt: 'a', refreshJwt: 'b', handle: 'x.bsky.social', did: 'did:plc:1', active: true } as never

describe('sessionEventToStoreAction', () => {
  it.each(['create', 'update'] as const)('%sイベントはsaveになる', (event) => {
    expect(sessionEventToStoreAction(event, session)).toEqual({ action: 'save', session })
  })

  it('expiredイベントはclearになる', () => {
    expect(sessionEventToStoreAction('expired', undefined)).toEqual({ action: 'clear' })
  })

  it.each(['create-failed', 'network-error'] as const)('%sイベントはnoopになる', (event) => {
    expect(sessionEventToStoreAction(event, undefined)).toEqual({ action: 'noop' })
  })
})
