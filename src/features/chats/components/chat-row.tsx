import type { LucideIcon } from 'lucide-react'
import type { ChatSummary, MessagePreview, SendState } from '@/lib/api'
import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import { BellOffIcon, CheckCheckIcon, CheckIcon, CircleAlertIcon, ClockIcon, PinIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { isMuted } from '@/lib/api'
import { formatChatListTime } from '@/lib/format'
import { ChatAvatar } from './chat-avatar'

const TICKS: Record<SendState['type'], { icon: LucideIcon, label: string, className?: string }> = {
  Pending: { icon: ClockIcon, label: 'pane.status.pending' },
  Sent: { icon: CheckIcon, label: 'pane.status.sent' },
  Delivered: { icon: CheckCheckIcon, label: 'pane.status.delivered' },
  Read: { icon: CheckCheckIcon, label: 'pane.status.read', className: 'text-primary' },
  Failed: { icon: CircleAlertIcon, label: 'pane.status.failed', className: 'text-destructive' },
}

/** The send state of the chat's last message, when it is our own. */
function SendTicks({ preview }: { preview: MessagePreview | null }) {
  const { t } = useTranslation('chat')
  if (!preview?.isOwn || !preview.sendState)
    return null
  const tick = TICKS[preview.sendState.type]
  const Icon = tick.icon
  return <Icon className={cn('size-3.5 shrink-0 text-muted-foreground', tick.className)} role="img" aria-label={t(tick.label)} />
}

export function ChatRow({ chat }: { chat: ChatSummary }) {
  const { t } = useTranslation('chat')
  const preview = chat.lastMessage
  const timeMs = preview?.sentAtMs ?? chat.updatedAtMs
  const stateLabel = chat.state === 'Leaving'
    ? t('list.state.leaving')
    : chat.state === 'Left'
      ? t('list.state.left')
      : null

  return (
    <Link
      to="/chats/$chatId"
      params={{ chatId: chat.chatId }}
      className="flex items-center gap-3 rounded-lg px-3 py-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
    >
      <ChatAvatar name={chat.name} colorKey={chat.chatId} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{chat.name}</span>
          {stateLabel && <span className="truncate text-xs text-muted-foreground">{stateLabel}</span>}
          {chat.pinned && <PinIcon className="size-3 shrink-0 text-muted-foreground" role="img" aria-label={t('list.pinned')} />}
          {isMuted(chat.mutedUntilMs) && <BellOffIcon className="size-3 shrink-0 text-muted-foreground" role="img" aria-label={t('list.muted')} />}
          <span className="ml-auto flex shrink-0 items-center gap-1 pl-1 text-xs text-muted-foreground">
            <SendTicks preview={preview} />
            {timeMs > 0 && formatChatListTime(timeMs)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-muted-foreground">
            {preview
              ? `${preview.isOwn
                ? t('list.you')
                : ''}${preview.text}`
              : t('list.noMessages')}
          </span>
          {chat.unreadCount > 0 && (
            <Badge className="ml-auto" aria-label={t('list.unread', { count: chat.unreadCount })}>
              {chat.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  )
}
