export interface TextBufferState {
  value: string
  cursor: number
}

export type TextBufferAction =
  | { type: 'insert'; text: string }
  | { type: 'backspace' }
  | { type: 'move-left' }
  | { type: 'move-right' }

export const initialTextBufferState: TextBufferState = { value: '', cursor: 0 }

export function textBufferReducer(state: TextBufferState, action: TextBufferAction): TextBufferState {
  switch (action.type) {
    case 'insert': {
      const value = state.value.slice(0, state.cursor) + action.text + state.value.slice(state.cursor)
      return { value, cursor: state.cursor + action.text.length }
    }
    case 'backspace': {
      if (state.cursor === 0) return state
      const value = state.value.slice(0, state.cursor - 1) + state.value.slice(state.cursor)
      return { value, cursor: state.cursor - 1 }
    }
    case 'move-left':
      return { ...state, cursor: Math.max(0, state.cursor - 1) }
    case 'move-right':
      return { ...state, cursor: Math.min(state.value.length, state.cursor + 1) }
    default:
      return state
  }
}
