import { useTerminalSize } from './useTerminalSize.js'

export function useTerminalRows(): number {
  return useTerminalSize().rows
}
