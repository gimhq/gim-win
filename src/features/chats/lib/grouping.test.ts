import type { MessageItem, TimelineItem } from '@/lib/api'
import { groupTimeline } from './grouping'

const MIN = 60_000

function message(id: string, senderId: string, sentAtMs: number): TimelineItem {
  const item: MessageItem = {
    messageId: id,
    chatId: 'c1',
    sender: {
      userId: senderId,
      handle: '',
      displayName: senderId,
      hasAvatar: false,
    },
    isOwn: false,
    sentAtMs,
    content: { type: 'Text', body: id },
    replyTo: null,
    reactions: [],
    edited: false,
    sendState: null,
  }
  return { type: 'Message', item }
}

/** `[messageId, first, last]` of each message row, `date` / `membership` otherwise. */
function shape(items: TimelineItem[]): (string | [string, boolean, boolean])[] {
  return groupTimeline(items).map(row => row.kind === 'message'
    ? [row.item.messageId, row.first, row.last]
    : row.kind)
}

describe('groupTimeline', () => {
  it('returns no rows for no items', () => {
    expect(groupTimeline([])).toEqual([])
  })

  it('marks a single message as both first and last', () => {
    expect(shape([
      message('m1', 'a', 0),
    ])).toEqual([
      ['m1', true, true],
    ])
  })

  it('groups consecutive messages of one sender within 5 minutes', () => {
    expect(shape([
      message('m1', 'a', 0),
      message('m2', 'a', 2 * MIN),
      message('m3', 'a', 7 * MIN),
    ])).toEqual([
      ['m1', true, false],
      ['m2', false, false],
      ['m3', false, true],
    ])
  })

  it('starts a new run on a gap over 5 minutes', () => {
    expect(shape([
      message('m1', 'a', 0),
      message('m2', 'a', 5 * MIN + 1),
    ])).toEqual([
      ['m1', true, true],
      ['m2', true, true],
    ])
  })

  it('starts a new run on another sender', () => {
    expect(shape([
      message('m1', 'a', 0),
      message('m2', 'b', MIN),
      message('m3', 'b', 2 * MIN),
    ])).toEqual([
      ['m1', true, true],
      ['m2', true, false],
      ['m3', false, true],
    ])
  })

  it('breaks runs at date separators and membership changes', () => {
    const items: TimelineItem[] = [
      message('m1', 'a', 0),
      { type: 'DateSeparator', dayStartMs: 86_400_000 },
      message('m2', 'a', MIN),
      {
        type: 'MembershipChange',
        userName: 'Bob',
        change: 'Added',
        atMs: 2 * MIN,
        userId: 'b',
        actorUserId: 'a',
      },
      message('m3', 'a', 3 * MIN),
    ]
    expect(shape(items)).toEqual([
      ['m1', true, true],
      'date',
      ['m2', true, true],
      'membership',
      ['m3', true, true],
    ])
  })

  it('carries the item index and the non-message fields', () => {
    const items: TimelineItem[] = [
      { type: 'DateSeparator', dayStartMs: 86_400_000 },
      {
        type: 'MembershipChange',
        userName: 'Bob',
        change: 'Left',
        atMs: 5,
        userId: 'b',
        actorUserId: null,
      },
      message('m1', 'a', 10),
    ]
    const rows = groupTimeline(items)
    expect(rows[0]).toEqual({ kind: 'date', dayStartMs: 86_400_000, index: 0 })
    expect(rows[1]).toEqual({
      kind: 'membership',
      userName: 'Bob',
      change: 'Left',
      atMs: 5,
      userId: 'b',
      actorUserId: null,
      index: 1,
    })
    expect(rows[2]).toMatchObject({
      kind: 'message',
      index: 2,
      first: true,
      last: true,
    })
    expect(rows[2].kind === 'message' && rows[2].item).toBe((items[2] as Extract<TimelineItem, { type: 'Message' }>).item)
  })
})
