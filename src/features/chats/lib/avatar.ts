/** Number of avatar colours; `avatarColor` returns an index below it. */
export const AVATAR_COLORS = 8

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null

function firstGrapheme(word: string): string {
  if (segmenter)
    return segmenter.segment(word).containing(0)?.segment ?? ''
  return Array.from(word)[0] ?? ''
}

/** The upper-cased first graphemes of the first two words of `name`; "?" when empty. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (words.length === 0)
    return '?'
  return words.map(firstGrapheme).join('').toUpperCase()
}

/** A stable colour index in `0..AVATAR_COLORS - 1` for `key` (FNV-1a hash). */
export function avatarColor(key: string): number {
  let hash = 0x811C9DC5
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) % AVATAR_COLORS
}
