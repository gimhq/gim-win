import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { chatState } from '@/lib/api'
import { register } from '@/lib/shortcuts'
import { CHAT_SCOPE } from '../hooks/use-chat-shortcuts'
import { selectChat, useChatListStore } from '../store'
import { ChatHeader } from './chat-header'
import { MessageList } from './message-list'
import { timelineStore, useTimelineStore } from './store'
import { TypingIndicator } from './typing-indicator'
import { useMarkRead } from './use-mark-read'
import { useMembers } from './use-members'

/** The open chat: header, timeline, typing line and the composer slot. */
export function ChatPane({ chatId }: { chatId: string }) {
  const { t } = useTranslation('chat')
  const navigate = useNavigate()
  const chat = useChatListStore(selectChat(chatId))
  const listReady = useChatListStore(state => state.status === 'ready')
  const failed = useTimelineStore(state => state.byChat[chatId]?.status === 'error')
  const { nameOf } = useMembers(chatId)
  const fallbackState = useQuery({
    queryKey: ['chatState', chatId],
    queryFn: () => chatState(chatId),
    enabled: chat === null && !listReady,
  })

  React.useEffect(() => {
    void timelineStore.getState().open(chatId)
    return () => {
      void timelineStore.getState().close(chatId)
    }
  }, [chatId])

  useMarkRead(chatId)

  React.useEffect(() => register(CHAT_SCOPE, 'Escape', () => {
    if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
      return false
    void navigate({ to: '/chats' })
  }), [navigate])

  if (failed || (chat === null && listReady)) {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">{t('errors.loadFailed')}</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <ChatHeader chat={chat} state={chat?.state ?? fallbackState.data ?? null} />
      <MessageList chatId={chatId} isGroup={chat?.kind === 'Group'} nameOf={nameOf} />
      <TypingIndicator chatId={chatId} nameOf={nameOf} />
      <div data-slot="composer-slot" />
    </main>
  )
}
