export interface InkKey {
  upArrow: boolean
  downArrow: boolean
  leftArrow: boolean
  rightArrow: boolean
  return: boolean
  escape: boolean
  ctrl: boolean
  shift: boolean
  meta: boolean
  tab: boolean
  backspace: boolean
  delete: boolean
}

export type ListNavAction = 'up' | 'down' | 'top' | 'bottom'

export type GlobalAction =
  | 'help'
  | 'quit'
  | 'back'
  | 'open-thread'
  | 'switch-timeline'
  | 'switch-notifications'
  | 'switch-search'
  | 'switch-profile'
  | 'like'
  | 'repost'
  | 'reply'
  | 'compose'
  | 'open-link'
  | 'view-image'
  | 'view-author'
  | 'delete'
