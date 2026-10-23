import type { AVATAR_COLORS } from '../lib/avatar'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
}

/** Initials of `name` on a stable colour derived from `colorKey`. */
export function ChatAvatar({ name, colorKey, size = 'default', className }: ChatAvatarProps) {
  return (
    <Avatar size={size} className={className} aria-hidden="true">
      <AvatarFallback className={cn('font-medium', COLOR_CLASSES[avatarColor(colorKey)])}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
