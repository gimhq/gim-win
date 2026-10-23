import {
  formatBytes,
  formatChatListTime,
  formatDate,
  formatDateTime,
  formatDayLabel,
  formatRelativeTime,
  formatTime,
} from './format'

// Local-time constructors keep the day boundaries stable in every time zone.
const now = new Date(2026, 9, 23, 14, 30).getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatBytes', () => {
  it('picks the unit and decimals', () => {
    expect(formatBytes(0, 'en-US')).toBe('0 B')
    expect(formatBytes(512, 'en-US')).toBe('512 B')
    expect(formatBytes(1024, 'en-US')).toBe('1 KB')
    expect(formatBytes(1536, 'en-US')).toBe('2 KB')
    expect(formatBytes(1.5 * 1024 * 1024, 'en-US')).toBe('1.5 MB')
    expect(formatBytes(2 * 1024 ** 3, 'en-US')).toBe('2.0 GB')
    expect(formatBytes(5000 * 1024 ** 3, 'en-US')).toBe('5,000.0 GB')
  })

  it('uses locale digits and separators', () => {
    expect(formatBytes(1.5 * 1024 * 1024, 'de-DE')).toBe('1,5 MB')
    expect(formatBytes(1.5 * 1024 * 1024, 'zh-CN')).toBe('1.5 MB')
  })
})

describe('time and date', () => {
  const instant = new Date(2026, 0, 5, 9, 7).getTime()

  it('formats hour and minute', () => {
    expect(formatTime(instant, 'en-US')).toBe('9:07 AM')
    expect(formatTime(instant, 'zh-CN')).toBe('9:07')
  })

  it('formats day, month and year', () => {
    expect(formatDate(instant, 'en-US')).toBe('Jan 5, 2026')
    expect(formatDate(instant, 'zh-CN')).toBe('2026年1月5日')
  })

  it('formats date and time together', () => {
    expect(formatDateTime(instant, 'en-US')).toBe(
      new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(instant),
    )
    expect(formatDateTime(instant, 'zh-CN')).toContain('2026年1月5日')
    expect(formatDateTime(instant, 'zh-CN')).toContain('9:07')
  })
})

describe('formatRelativeTime', () => {
  it('says now under a minute', () => {
    expect(formatRelativeTime(now - 30_000, now, 'en-US')).toBe('now')
    expect(formatRelativeTime(now, now, 'zh-CN')).toBe('现在')
  })

  it('uses the largest fitting unit', () => {
    expect(formatRelativeTime(now - 5 * MINUTE, now, 'en-US')).toBe('5 minutes ago')
    expect(formatRelativeTime(now - 3 * HOUR, now, 'en-US')).toBe('3 hours ago')
    expect(formatRelativeTime(now - DAY, now, 'en-US')).toBe('yesterday')
    expect(formatRelativeTime(now - 2 * DAY, now, 'en-US')).toBe('2 days ago')
    expect(formatRelativeTime(now - 10 * DAY, now, 'en-US')).toBe('last week')
    expect(formatRelativeTime(now - 45 * DAY, now, 'en-US')).toBe('last month')
    expect(formatRelativeTime(now - 400 * DAY, now, 'en-US')).toBe('last year')
    expect(formatRelativeTime(now + 2 * HOUR, now, 'en-US')).toBe('in 2 hours')
    expect(formatRelativeTime(now - 5 * MINUTE, now, 'zh-CN')).toBe('5分钟前')
  })
})

describe('formatChatListTime', () => {
  it('shows the time for today', () => {
    const morning = new Date(2026, 9, 23, 8, 5).getTime()
    expect(formatChatListTime(morning, now, 'en-US')).toBe('8:05 AM')
    expect(formatChatListTime(morning, now, 'zh-CN')).toBe('8:05')
  })

  it('shows the short weekday within six days', () => {
    const yesterday = new Date(2026, 9, 22, 23, 59).getTime()
    expect(formatChatListTime(yesterday, now, 'en-US')).toBe('Thu')
    expect(formatChatListTime(yesterday, now, 'zh-CN')).toBe('周四')
    const sixDaysAgo = new Date(2026, 9, 17, 1, 0).getTime()
    expect(formatChatListTime(sixDaysAgo, now, 'en-US')).toBe('Sat')
  })

  it('shows the date beyond six days or in the future', () => {
    const sevenDaysAgo = new Date(2026, 9, 16, 12, 0).getTime()
    expect(formatChatListTime(sevenDaysAgo, now, 'en-US')).toBe('Oct 16, 2026')
    const tomorrow = new Date(2026, 9, 24, 12, 0).getTime()
    expect(formatChatListTime(tomorrow, now, 'en-US')).toBe('Oct 24, 2026')
  })
})

describe('formatDayLabel', () => {
  it('classifies today, yesterday and older dates', () => {
    expect(formatDayLabel(new Date(2026, 9, 23, 0, 0).getTime(), now, 'en-US')).toEqual({
      kind: 'today',
      text: 'Oct 23, 2026',
    })
    expect(formatDayLabel(new Date(2026, 9, 22, 23, 59).getTime(), now, 'en-US')).toEqual({
      kind: 'yesterday',
      text: 'Oct 22, 2026',
    })
    expect(formatDayLabel(new Date(2026, 9, 21, 12, 0).getTime(), now, 'zh-CN')).toEqual({
      kind: 'date',
      text: '2026年10月21日',
    })
  })
})
