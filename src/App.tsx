import React, { useEffect, useMemo, useReducer, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { InkPictureProvider } from 'ink-picture'
import { createKeychainSessionStore } from './auth/session-store.js'
import { createAuthSession, loginWithAppPassword, resumeAgent } from './auth/auth-agent.js'
import { screenStackReducer, initialScreenStackState } from './navigation/screen-stack.js'
import { LoginScreen } from './screens/LoginScreen.js'
import { TimelineScreen } from './screens/TimelineScreen.js'
import { ThreadScreen } from './screens/ThreadScreen.js'
import { ComposeScreen } from './screens/ComposeScreen.js'
import { NotificationsScreen } from './screens/NotificationsScreen.js'
import { ProfileScreen } from './screens/ProfileScreen.js'
import { HelpOverlay } from './components/HelpOverlay.js'
import { HeaderBar } from './components/HeaderBar.js'
import { getHeaderLabel } from './navigation/header-label.js'
import { fetchUnreadCount } from './api/client.js'
import { resolveGlobalAction } from './keymap/global-keymap.js'
import type { AtpClient } from './api/atp-client.js'
import type { NotificationItem, PostSummary, TimelineItem } from './api/types.js'

const UNREAD_POLL_INTERVAL_MS = 60000

export function App() {
  const { exit } = useApp()
  const [stack, dispatch] = useReducer(screenStackReducer, initialScreenStackState)
  const [client, setClient] = useState<AtpClient | null>(null)
  const [loginError, setLoginError] = useState<string>()
  const [loggingIn, setLoggingIn] = useState(false)
  const [timelineState, setTimelineState] = useState<{
    items: TimelineItem[]
    cursor: string | undefined
    index: number
  }>({ items: [], cursor: undefined, index: 0 })
  const [threadState, setThreadState] = useState<{ uri: string; posts: PostSummary[]; index: number } | null>(null)
  const [notificationsState, setNotificationsState] = useState<{
    items: NotificationItem[]
    cursor: string | undefined
    index: number
  }>({ items: [], cursor: undefined, index: 0 })
  const [profileState, setProfileState] = useState<{
    actor: string
    items: TimelineItem[]
    cursor: string | undefined
    index: number
  } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const store = useMemo(() => createKeychainSessionStore(), [])

  function createSession(serviceUrl: string) {
    return createAuthSession(serviceUrl, store, () => {
      setClient(null)
      dispatch({ type: 'reset', screen: { name: 'login' } })
    })
  }

  useEffect(() => {
    const saved = store.load()
    if (!saved) {
      dispatch({ type: 'reset', screen: { name: 'login' } })
      return
    }
    try {
      const authSession = createSession(saved.serviceUrl)
      resumeAgent(authSession, saved.session)
        .then((agent) => {
          setClient(agent as unknown as AtpClient)
          dispatch({ type: 'reset', screen: { name: 'timeline' } })
        })
        .catch(() => {
          dispatch({ type: 'reset', screen: { name: 'login' } })
        })
    } catch {
      dispatch({ type: 'reset', screen: { name: 'login' } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!client) return
    const activeClient = client
    let cancelled = false
    async function poll() {
      try {
        const count = await fetchUnreadCount(activeClient)
        if (!cancelled) setUnreadCount(count)
      } catch {
        // 前回値を維持
      }
    }
    poll()
    const interval = setInterval(poll, UNREAD_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [client])

  async function handleLoginSubmit(identifier: string, password: string, serviceUrl: string) {
    setLoggingIn(true)
    setLoginError(undefined)
    try {
      const authSession = createSession(serviceUrl)
      const agent = await loginWithAppPassword(authSession, identifier, password)
      setClient(agent as unknown as AtpClient)
      dispatch({ type: 'reset', screen: { name: 'timeline' } })
    } catch {
      setLoginError('ログインに失敗しました — Handle / App Passwordを確認')
    } finally {
      setLoggingIn(false)
    }
  }

  function handleLogout() {
    store.clear()
    setClient(null)
    setShowHelp(false)
    dispatch({ type: 'reset', screen: { name: 'login' } })
  }

  const top = stack.stack[stack.stack.length - 1]

  useInput(
    (input) => {
      if (input === 'q') exit()
    },
    { isActive: !showHelp && (top.name === 'timeline' || top.name === 'notifications') },
  )

  useInput(
    (input) => {
      if (input === '?') setShowHelp(true)
    },
    { isActive: !showHelp && top.name !== 'login' && top.name !== 'compose' },
  )

  useInput(
    (input) => {
      if (input === 'Q') {
        handleLogout()
        return
      }
      setShowHelp(false)
    },
    { isActive: showHelp },
  )

  function openThread(uri: string) {
    dispatch({ type: 'push', screen: { name: 'thread', uri } })
  }
  function switchToTimeline() {
    dispatch({ type: 'reset', screen: { name: 'timeline' } })
  }
  function switchToNotifications() {
    setUnreadCount(0)
    dispatch({ type: 'reset', screen: { name: 'notifications' } })
  }
  function openProfile(actor?: string) {
    const target = actor ?? client?.did
    if (!target) return
    dispatch({ type: 'push', screen: { name: 'profile', actor: target } })
  }
  function openCompose(replyTarget?: PostSummary, replyRoot?: PostSummary) {
    dispatch({
      type: 'push',
      screen: {
        name: 'compose',
        replyTo: replyTarget
          ? {
              root: { uri: (replyRoot ?? replyTarget).uri, cid: (replyRoot ?? replyTarget).cid },
              parent: { uri: replyTarget.uri, cid: replyTarget.cid },
            }
          : undefined,
      },
    })
  }
  function pop() {
    dispatch({ type: 'pop' })
  }
  function handleComposeDone() {
    setTimelineState({ items: [], cursor: undefined, index: 0 })
    pop()
  }

  useInput(
    (input, key) => {
      const action = resolveGlobalAction(input, key)
      if (action === 'switch-timeline' && top.name !== 'timeline') {
        switchToTimeline()
        return
      }
      if (action === 'switch-notifications' && top.name !== 'notifications') {
        switchToNotifications()
        return
      }
      if (action === 'switch-profile') {
        if (top.name === 'profile' && top.actor === client?.did) return
        openProfile()
      }
    },
    { isActive: !showHelp && top.name !== 'login' && top.name !== 'compose' },
  )

  return (
    <InkPictureProvider config={{ pollIntervalMs: 3600000 }}>
      <Box flexDirection="column">
        {showHelp && <HelpOverlay />}
        {!showHelp && (
          <>
            {top.name !== 'login' && (
              <>
                <HeaderBar label={getHeaderLabel(top)} count={unreadCount} />
                <Text> </Text>
              </>
            )}
            {top.name === 'login' && (
              <LoginScreen onSubmit={handleLoginSubmit} error={loginError} submitting={loggingIn} />
            )}
            {client && top.name === 'timeline' && (
              <TimelineScreen
                client={client}
                active={true}
                initialItems={timelineState.items}
                initialCursor={timelineState.cursor}
                initialIndex={timelineState.index}
                onStateChange={setTimelineState}
                onOpenThread={openThread}
                onReply={(post) => openCompose(post)}
                onCompose={() => openCompose()}
                onOpenProfile={openProfile}
              />
            )}
            {client && top.name === 'notifications' && (
              <NotificationsScreen
                client={client}
                active={true}
                initialItems={notificationsState.items}
                initialCursor={notificationsState.cursor}
                initialIndex={notificationsState.index}
                onStateChange={setNotificationsState}
                onOpenThread={openThread}
                onOpenProfile={openProfile}
              />
            )}
            {client && top.name === 'thread' && (
              <ThreadScreen
                client={client}
                uri={top.uri}
                active={true}
                initialPosts={threadState?.uri === top.uri ? threadState.posts : []}
                initialIndex={threadState?.uri === top.uri ? threadState.index : 0}
                onStateChange={(posts, index) => setThreadState({ uri: top.uri, posts, index })}
                onReply={(post, root) => openCompose(post, root)}
                onBack={pop}
                onOpenProfile={openProfile}
              />
            )}
            {client && top.name === 'compose' && (
              <ComposeScreen client={client} replyTo={top.replyTo} onDone={handleComposeDone} onCancel={pop} />
            )}
            {client && top.name === 'profile' && (
              <ProfileScreen
                client={client}
                actor={top.actor}
                active={true}
                onBack={pop}
                onOpenThread={openThread}
                onReply={(post) => openCompose(post)}
                initialItems={profileState?.actor === top.actor ? profileState.items : []}
                initialCursor={profileState?.actor === top.actor ? profileState.cursor : undefined}
                initialIndex={profileState?.actor === top.actor ? profileState.index : 0}
                onStateChange={(state) => setProfileState({ actor: top.actor, ...state })}
              />
            )}
          </>
        )}
      </Box>
    </InkPictureProvider>
  )
}
