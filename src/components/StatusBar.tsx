import React from 'react'
import { Box, Text } from 'ink'

export function StatusBar({ hint, status, error }: { hint: string; status?: string; error?: string }) {
  return (
    <Box borderStyle="single" borderColor={error ? 'red' : 'gray'} paddingX={1}>
      <Text color={error ? 'red' : 'gray'}>{error ?? status ?? hint}</Text>
    </Box>
  )
}
