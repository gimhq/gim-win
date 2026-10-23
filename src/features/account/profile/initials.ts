/** Background classes for initials avatars; `avatarColor` picks one per user. */
export const AVATAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-fuchsia-500',
] as const

/** First letters of up to two words, uppercase; `?` for an empty name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0)
    return '?'
  return words
    .slice(0, 2)
    .map(word => Array.from(word)[0]!.toUpperCase())
    .join('')
}

/** A stable palette class from a hash of the user id. */
export function avatarColor(userId: string): string {
  let hash = 0
  for (const char of userId)
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}
