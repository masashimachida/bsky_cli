import React from 'react'
import { Box, Text } from 'ink'
import { useTerminalSize } from '../navigation/useTerminalSize.js'

export function Modal({
  width,
  height,
  children,
}: {
  width: number
  height: number
  children: React.ReactNode
}) {
  const { rows, columns } = useTerminalSize()
  const w = Math.min(width, columns)
  const h = Math.min(height, rows)
  const marginTop = Math.max(0, Math.floor((rows - h) / 2))
  const marginLeft = Math.max(0, Math.floor((columns - w) / 2))
  const blankRow = ' '.repeat(w)

  return (
    <>
      <Box
        position="absolute"
        marginTop={marginTop}
        marginLeft={marginLeft}
        width={w}
        height={h}
        flexDirection="column"
      >
        {Array.from({ length: h }).map((_, i) => (
          <Text key={i}>{blankRow}</Text>
        ))}
      </Box>
      <Box
        position="absolute"
        marginTop={marginTop}
        marginLeft={marginLeft}
        width={w}
        height={h}
        flexDirection="column"
      >
        {children}
      </Box>
    </>
  )
}
