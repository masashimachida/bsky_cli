import React from 'react'
import { Box, Text } from 'ink'
import { Modal } from './Modal.js'

export function ConfirmDialog({
  message,
  confirmLabel = 'y: 削除',
  cancelLabel = 'n: キャンセル',
}: {
  message: string
  confirmLabel?: string
  cancelLabel?: string
}) {
  return (
    <Modal width={40} height={5}>
      <Box flexDirection="column" alignItems="center" justifyContent="center" width={40} height={5} borderStyle="double" borderColor="yellow">
        <Text>{message}</Text>
        <Text dimColor>
          {confirmLabel} / {cancelLabel}
        </Text>
      </Box>
    </Modal>
  )
}
