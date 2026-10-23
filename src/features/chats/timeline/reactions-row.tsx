import type { MessageItem } from '@/lib/api'
import { cn } from 'cn'
import { react, unreact } from '@/lib/api'

/** One chip per reaction group; a click toggles the own reaction. */
export function ReactionsRow({ message }: { message: MessageItem }) {
  if (message.reactions.length === 0)
    return null
  return (
    <div className={cn('mt-1 flex flex-wrap gap-1', message.isOwn && 'justify-end')}>
      {message.reactions.map((group) => {
        const toggle = group.own
          ? unreact
          : react
        return (
          <button
            key={group.emoji}
            type="button"
            aria-pressed={group.own}
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
              group.own
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background',
            )}
            onClick={() => {
              toggle(message.chatId, message.messageId, group.emoji).catch((error: unknown) => {
                console.error('reaction failed', error)
              })
            }}
          >
            {`${group.emoji} ${group.count}`}
          </button>
        )
      })}
    </div>
  )
}
