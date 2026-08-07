import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { DEFAULT_SERVICE_URL } from '../auth/auth-agent.js'

const FIELDS = ['identifier', 'password', 'serviceUrl'] as const
type Field = (typeof FIELDS)[number]

export function LoginScreen({
  onSubmit,
  error,
  submitting,
}: {
  onSubmit: (identifier: string, password: string, serviceUrl: string) => void
  error?: string
  submitting: boolean
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [serviceUrl, setServiceUrl] = useState(DEFAULT_SERVICE_URL)
  const [field, setField] = useState<Field>('identifier')

  useInput(
    (_input, key) => {
      if (key.tab || key.downArrow || key.upArrow) {
        setField((f) => FIELDS[(FIELDS.indexOf(f) + 1) % FIELDS.length])
      }
    },
    { isActive: !submitting },
  )

  function handleSubmit() {
    if (field === 'identifier') {
      setField('password')
      return
    }
    if (field === 'password') {
      setField('serviceUrl')
      return
    }
    onSubmit(identifier, password, serviceUrl || DEFAULT_SERVICE_URL)
  }

  return (
    <Box flexDirection="column" borderStyle="round" padding={1}>
      <Text bold>bskytui ログイン</Text>
      <Text dimColor>Handle（例: user.bsky.social）と App Password（bsky.app設定画面で発行）を入力</Text>
      <Box marginTop={1}>
        <Text>Handle: </Text>
        <TextInput value={identifier} onChange={setIdentifier} onSubmit={handleSubmit} focus={!submitting && field === 'identifier'} />
      </Box>
      <Box>
        <Text>App Password: </Text>
        <TextInput value={password} onChange={setPassword} onSubmit={handleSubmit} mask="*" focus={!submitting && field === 'password'} />
      </Box>
      <Box>
        <Text>プロバイダ: </Text>
        <TextInput value={serviceUrl} onChange={setServiceUrl} onSubmit={handleSubmit} focus={!submitting && field === 'serviceUrl'} />
      </Box>
      {submitting && <Text dimColor>ログイン中...</Text>}
      {error && <Text color="red">{error}</Text>}
      <Text dimColor>Tab/矢印で入力欄切替、Enterで次へ・送信</Text>
    </Box>
  )
}
