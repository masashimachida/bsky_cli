import type { ImageAttachment } from '../api/types.js'

export type ScreenId =
  | { name: 'login' }
  | { name: 'timeline' }
  | { name: 'thread'; uri: string }
  | {
      name: 'compose'
      replyTo?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } }
    }
  | { name: 'notifications' }
  | { name: 'search' }
  | { name: 'profile'; actor: string }
  | { name: 'image-view'; images: ImageAttachment[]; initialIndex: number }

export interface ScreenStackState {
  stack: ScreenId[]
}

export type ScreenStackAction =
  | { type: 'push'; screen: ScreenId }
  | { type: 'pop' }
  | { type: 'reset'; screen: ScreenId }

export function screenStackReducer(state: ScreenStackState, action: ScreenStackAction): ScreenStackState {
  switch (action.type) {
    case 'push':
      return { stack: [...state.stack, action.screen] }
    case 'pop':
      return state.stack.length > 1 ? { stack: state.stack.slice(0, -1) } : state
    case 'reset':
      return { stack: [action.screen] }
    default:
      return state
  }
}

export const initialScreenStackState: ScreenStackState = { stack: [{ name: 'login' }] }
