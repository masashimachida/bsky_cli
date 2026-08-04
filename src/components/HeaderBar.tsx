import React from 'react'
import { Box, Text } from 'ink'

export function HeaderBar({ label, count }: { label: string; count: number }) {
  return (
    <Box backgroundColor="#1185FE" paddingX={1} justifyContent="space-between">
      <Text color="#FFFFFF">{label}</Text>
      <Text bold={count >= 1} color={count >= 1 ? 'yellow' : '#FFFFFF'}>
        ({count})
      </Text>
    </Box>
  )
}
