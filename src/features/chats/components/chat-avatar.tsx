import type { AVATAR_COLORS } from '../lib/avatar'
import type { ChatSummary } from '@/lib/api'
import { cn } from 'cn'
import { NotebookPenIcon } from 'lucide-react'
import { Avatar, AvatarBadge, AvatarFallback } from '@/components/ui/avatar'
import { avatarColor, initials } from '../lib/avatar'

/** One background per `avatarColor` index; the length is `AVATAR_COLORS`. */
const COLOR_CLASSES = [
  'bg-red-500 text-white',
  'bg-orange-500 text-white',
  'bg-amber-500 text-white',
  'bg-emerald-500 text-white',
  'bg-teal-500 text-white',
  'bg-sky-500 text-white',
  'bg-indigo-500 text-white',
  'bg-pink-500 text-white',
] as const satisfies { length: typeof AVATAR_COLORS }

interface ChatAvatarProps {
  name: string
  /** The id the colour is derived from (chat id or user id). */
  colorKey: string
  size?: 'default' | 'sm' | 'lg'
  className?: string
  /** Marks the note to self. */
  noteBadge?: boolean
}

/** Initials of `name` on a stable colour derived from `colorKey`. */
export function ChatAvatar({ name, colorKey, size = 'default', className, noteBadge }: ChatAvatarProps) {
  return (
    <Avatar size={size} className={className} aria-hidden="true">
      <AvatarFallback className={cn('font-medium', COLOR_CLASSES[avatarColor(colorKey)])}>
        {initials(name)}
      </AvatarFallback>
      {noteBadge && (
        <AvatarBadge
          data-testid="note-badge"
          className="-right-0.5 -bottom-0.5 group-data-[size=default]/avatar:size-3.5 group-data-[size=lg]/avatar:size-4 group-data-[size=sm]/avatar:size-3 group-data-[size=default]/avatar:[&>svg]:size-2 group-data-[size=lg]/avatar:[&>svg]:size-2.5"
        >
          <NotebookPenIcon />
        </AvatarBadge>
      )}
    </Avatar>
  )
}

/** A chat's avatar: the note to self shows the own initials and colour with a note badge. */
export function ChatSummaryAvatar({ chat, size }: { chat: ChatSummary, size?: ChatAvatarProps['size'] }) {
  if (chat.isNoteToSelf && chat.peer)
    return <ChatAvatar name={chat.peer.displayName} colorKey={chat.peer.userId} size={size} noteBadge />
  return <ChatAvatar name={chat.name} colorKey={chat.chatId} size={size} />
}
