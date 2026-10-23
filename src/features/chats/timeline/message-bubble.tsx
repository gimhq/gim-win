import type { NameOf } from './use-members'
import type { MessageContent, MessageItem, SendFailure } from '@/lib/api'
import { openUrl } from '@tauri-apps/plugin-opener'
import { cn } from 'cn'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { formatTime } from '@/lib/format'
import { ChatAvatar } from '../components/chat-avatar'
import { FileContent } from './file-content'
import { ImageContent } from './image-content'
import { ReactionsRow } from './reactions-row'
import { ReplyQuote } from './reply-quote'
import { StatusTicks } from './status-ticks'

const FAILURE_KEYS: Record<SendFailure, string> = {
  UserSuspended: 'actions.failed.suspended',
  UserNotAdmitted: 'actions.failed.notAdmitted',
  NotAdmittedByPeer: 'actions.failed.notAdmittedByPeer',
  Rejected: 'actions.failed.rejected',
  Other: 'actions.failed.other',
}

const URL_PATTERN = /https?:\/\/[^\s/?#<>"']\S*/gi
const TRAILING = /[.,;:!?)"'”’»]+$/

/** The body with http(s) URLs as links that open in the system browser. */
function TextBody({ body }: { body: string }) {
  const parts: React.ReactNode[] = []
  let cursor = 0
  for (const match of body.matchAll(URL_PATTERN)) {
    const url = match[0].replace(TRAILING, '')
    const start = match.index
    if (start > cursor)
      parts.push(body.slice(cursor, start))
    parts.push(
      <a
        key={start}
        href={url}
        className="underline underline-offset-2"
        onClick={(event) => {
          event.preventDefault()
          openUrl(url).catch((error: unknown) => {
            console.error('open_url failed', error)
          })
        }}
      >
        {url}
      </a>,
    )
    cursor = start + url.length
  }
  if (cursor < body.length)
    parts.push(body.slice(cursor))
  return <p className="break-words whitespace-pre-wrap">{parts}</p>
}

function Content({ content }: { content: MessageContent }) {
  const { t } = useTranslation('chat')
  switch (content.type) {
    case 'Text':
      return <TextBody body={content.body} />
    case 'Image':
      return <ImageContent content={content} />
    case 'File':
      return <FileContent content={content} />
    case 'Deleted':
      return <p className="italic opacity-70">{t('pane.deleted')}</p>
    case 'Unsupported':
      return <p className="italic opacity-70">{t('pane.unsupported')}</p>
  }
}

interface MessageBubbleProps {
  message: MessageItem
  /** Starts a run of one sender's messages. */
  first: boolean
  /** Ends that run. */
  last: boolean
  isGroup: boolean
  highlighted: boolean
  nameOf: NameOf
  onJump: (messageId: string) => void
}

export function MessageBubble({ message, first, last, isGroup, highlighted, nameOf, onJump }: MessageBubbleProps) {
  const { t } = useTranslation('chat')
  const own = message.isOwn
  const senderName = message.sender.displayName || nameOf(message.sender.userId)
  const failure = message.sendState?.type === 'Failed'
    ? message.sendState
    : null

  return (
    <div
      data-message-id={message.messageId}
      data-own={own}
      data-first={first}
      data-last={last}
      data-highlighted={highlighted}
      className={cn('flex gap-2 px-4', own
        ? 'justify-end'
        : 'justify-start', first
        ? 'pt-2'
        : 'pt-0.5')}
    >
      {!own && (first
        ? <ChatAvatar name={senderName} colorKey={message.sender.userId} size="sm" className="mt-0.5" />
        : <span className="w-6 shrink-0" aria-hidden="true" />)}
      <div className={cn('flex max-w-[70%] min-w-0 flex-col', own && 'items-end')}>
        <div
          className={cn(
            'min-w-0 rounded-2xl px-3 py-1.5 text-sm transition-shadow',
            own
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground',
            own && !first && 'rounded-tr-md',
            own && !last && 'rounded-br-md',
            !own && !first && 'rounded-tl-md',
            !own && !last && 'rounded-bl-md',
            highlighted && 'ring-2 ring-ring',
          )}
        >
          {isGroup && !own && first && <p className="text-xs font-medium text-primary">{senderName}</p>}
          {message.replyTo && <ReplyQuote reply={message.replyTo} isOwn={own} onJump={onJump} />}
          <Content content={message.content} />
          <div className={cn('mt-0.5 flex items-center justify-end gap-1 text-[0.7rem]', own
            ? 'text-primary-foreground/70'
            : 'text-muted-foreground')}
          >
            {message.edited && <span>{t('pane.edited')}</span>}
            <span>{formatTime(message.sentAtMs)}</span>
            {own && message.sendState && (
              <StatusTicks
                state={message.sendState}
                className={message.sendState.type === 'Read'
                  ? 'text-primary-foreground'
                  : undefined}
              />
            )}
          </div>
        </div>
        <ReactionsRow message={message} />
        {failure && <p className="mt-0.5 text-xs text-destructive">{t(FAILURE_KEYS[failure.cause])}</p>}
      </div>
    </div>
  )
}
