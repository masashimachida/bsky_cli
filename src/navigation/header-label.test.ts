import { describe, expect, it } from 'vitest'
import { getHeaderLabel } from './header-label.js'

describe('getHeaderLabel', () => {
  it('timelineはFollowing', () => {
    expect(getHeaderLabel({ name: 'timeline' })).toBe('Following')
  })

  it('notificationsはNotifications', () => {
    expect(getHeaderLabel({ name: 'notifications' })).toBe('Notifications')
  })

  it('threadはThread', () => {
    expect(getHeaderLabel({ name: 'thread', uri: 'at://x' })).toBe('Thread')
  })

  it('profileはProfile', () => {
    expect(getHeaderLabel({ name: 'profile', actor: 'did:plc:1' })).toBe('Profile')
  })

  it('composeでreplyTo無しはCompose', () => {
    expect(getHeaderLabel({ name: 'compose' })).toBe('Compose')
  })

  it('composeでreplyTo有りはReply', () => {
    expect(
      getHeaderLabel({
        name: 'compose',
        replyTo: { root: { uri: 'r', cid: 'rc' }, parent: { uri: 'p', cid: 'pc' } },
      }),
    ).toBe('Reply')
  })

  it('searchはSearch', () => {
    expect(getHeaderLabel({ name: 'search' })).toBe('Search')
  })

  it('image-viewはImage', () => {
    expect(getHeaderLabel({ name: 'image-view', images: [], initialIndex: 0 })).toBe('Image')
  })

  it('loginは空文字', () => {
    expect(getHeaderLabel({ name: 'login' })).toBe('')
  })
})
