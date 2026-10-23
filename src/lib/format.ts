/**
 * Locale-aware formatting helpers. Every function is pure and takes the
 * locale explicitly; the default is the active i18n language.
 */

import { i18n } from '@/i18n'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function currentLocale(): string {
  return i18n.language || 'en'
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const

/** "512 B", "3 KB", "1.5 MB", "2.0 GB"; one decimal above KB. */
export function formatBytes(size: number, locale: string = currentLocale()): string {
  let value = Math.max(0, size)
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit > 1
    ? 1
    : 0
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
  return `${number} ${BYTE_UNITS[unit]}`
}

/** Hour and minute. */
export function formatTime(ms: number, locale: string = currentLocale()): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(ms)
}

/** Day, month and year. */
export function formatDate(ms: number, locale: string = currentLocale()): string {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(ms)
}

export function formatDateTime(ms: number, locale: string = currentLocale()): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ms)
}

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * DAY],
  ['month', 30 * DAY],
  ['week', 7 * DAY],
  ['day', DAY],
  ['hour', HOUR],
  ['minute', MINUTE],
]

/** "now" under a minute, otherwise the largest fitting unit ("5 minutes ago", "in 2 days"). */
export function formatRelativeTime(ms: number, now: number = Date.now(), locale: string = currentLocale()): string {
  const diff = ms - now
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const magnitude = Math.abs(diff)
  for (const [unit, size] of RELATIVE_UNITS) {
    if (magnitude >= size)
      return rtf.format(Math.trunc(diff / size), unit)
  }
  return rtf.format(0, 'second')
}

function startOfDay(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Whole local days between the two instants (positive when `ms` is before `now`). */
function daysBetween(ms: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(ms)) / DAY)
}

/** Time if today, short weekday within the last 6 days, otherwise the date. */
export function formatChatListTime(ms: number, now: number = Date.now(), locale: string = currentLocale()): string {
  const days = daysBetween(ms, now)
  if (days === 0)
    return formatTime(ms, locale)
  if (days > 0 && days <= 6)
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(ms)
  return formatDate(ms, locale)
}

export interface DayLabel {
  kind: 'today' | 'yesterday' | 'date'
  /** The formatted date; callers translate `today` and `yesterday` themselves. */
  text: string
}

export function formatDayLabel(ms: number, now: number = Date.now(), locale: string = currentLocale()): DayLabel {
  const days = daysBetween(ms, now)
  const text = formatDate(ms, locale)
  if (days === 0)
    return { kind: 'today', text }
  if (days === 1)
    return { kind: 'yesterday', text }
  return { kind: 'date', text }
}
