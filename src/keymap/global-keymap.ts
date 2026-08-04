import type { GlobalAction, InkKey } from './types.js'

export function resolveGlobalAction(input: string, key: InkKey): GlobalAction | null {
  if (input === '?') return 'help'
  if (input === 'q') return 'quit'
  if (key.escape || input === 'h') return 'back'
  if (key.return) return 'open-thread'
  if (input === '1') return 'switch-timeline'
  if (input === '2') return 'switch-notifications'
  if (input === '3') return 'switch-search'
  if (input === '4') return 'switch-profile'
  if (input === 'f') return 'like'
  if (input === 'R') return 'repost'
  if (input === 'r') return 'reply'
  if (input === 'n') return 'compose'
  if (input === 'o') return 'open-link'
  if (input === 'i') return 'view-image'
  if (input === 'u') return 'view-author'
  if (input === 'd') return 'delete'
  return null
}
