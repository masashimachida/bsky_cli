import type { InkKey, ListNavAction } from './types.js'

export function resolveListNavigation(input: string, key: InkKey): ListNavAction | null {
  if (key.downArrow || input === 'j') return 'down'
  if (key.upArrow || input === 'k') return 'up'
  if (input === 'g') return 'top'
  if (input === 'G') return 'bottom'
  return null
}
