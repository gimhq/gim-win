import type { ReactNode } from 'react'
import type { ChatState, ChatSummary } from '@/lib/api'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatSummaryAvatar } from '../components/chat-avatar'
import { chatTitle } from '../lib/chat-title'

interface ChatHeaderProps {
  /** Null while the chat is not in the list yet. */
  chat: ChatSummary | null
  /** From the list, or from the api while the chat is not listed yet. */
  state: ChatState | null
  /** Header buttons, e.g. the members sheet. */
  actions?: ReactNode
}

export function ChatHeader({ chat, state, actions }: ChatHeaderProps) {
  const { t } = useTranslation('chat')
  const subtitle = chat?.kind === 'Group'
    ? t('pane.members', { count: chat.memberCount })
    : ''
  return (
    <header className="flex flex-col border-b border-border">
      <div className="flex items-center gap-3 px-4 py-2">
        {chat
          ? <ChatSummaryAvatar chat={chat} />
          : <Skeleton className="size-8 rounded-full" />}
        <div className="flex min-w-0 flex-1 flex-col">
          {chat
            ? <h1 className="truncate text-sm font-semibold">{chatTitle(chat, t)}</h1>
            : <Skeleton className="h-4 w-32" />}
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div data-slot="pane-actions" className="flex items-center gap-1">{actions}</div>
      </div>
      {(state === 'Leaving' || state === 'Left') && (
        <p role="status" className="bg-muted px-4 py-1.5 text-xs text-muted-foreground">
          {t(state === 'Leaving'
            ? 'pane.state.leaving'
            : 'pane.state.left')}
        </p>
      )}
    </header>
  )
}
