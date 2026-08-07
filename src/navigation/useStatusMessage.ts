import { useEffect } from 'react'

export interface StatusMessage {
  text: string
  error: boolean
}

export function useStatusMessage(
  onStatusChange: (message: StatusMessage | null) => void,
  status: string | undefined,
  error: string | undefined,
) {
  useEffect(() => {
    const text = error ?? status
    onStatusChange(text ? { text, error: !!error } : null)
    return () => onStatusChange(null)
  }, [status, error, onStatusChange])
}
