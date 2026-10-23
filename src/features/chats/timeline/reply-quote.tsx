import type { ReplyPreview } from '@/lib/api'
import { cn } from 'cn'

interface ReplyQuoteProps {
  reply: ReplyPreview
  isOwn: boolean
  onJump: (messageId: string) => void
}

export function ReplyQuote({ reply, isOwn, onJump }: ReplyQuoteProps) {
  return (
    <button
      type="button"
      className={cn(
        'mb-1 flex w-full min-w-0 flex-col rounded-md border-l-2 px-2 py-1 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isOwn
          ? 'border-primary-foreground/60 bg-primary-foreground/10'
          : 'border-primary bg-background/60',
      )}
      onClick={() => onJump(reply.messageId)}
    >
      <span className="truncate font-medium">{reply.senderName}</span>
      <span className="truncate opacity-80">{reply.text}</span>
    </button>
  )
}
