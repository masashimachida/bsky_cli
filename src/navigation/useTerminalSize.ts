import { useEffect, useState } from 'react'
import { useStdout } from 'ink'

const FALLBACK_ROWS = 24
const FALLBACK_COLUMNS = 80

export function useTerminalSize(): { rows: number; columns: number } {
  const { stdout } = useStdout()
  const [size, setSize] = useState({
    rows: stdout.rows || FALLBACK_ROWS,
    columns: stdout.columns || FALLBACK_COLUMNS,
  })

  useEffect(() => {
    const onResize = () => {
      setSize({
        rows: stdout.rows || FALLBACK_ROWS,
        columns: stdout.columns || FALLBACK_COLUMNS,
      })
    }
    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout])

  return size
}
