import type { MembershipChangeKind, MessageItem, TimelineItem } from '@/lib/api'

/** Messages of one sender less than this apart share a run. */
export const GROUP_GAP_MS = 5 * 60_000

/** One render row; `index` is the position of its item in the timeline. */
export type Row
  = | {
    kind: 'message'
    item: MessageItem
    index: number
    /** Starts a run of consecutive messages of one sender. */
    first: boolean
    /** Ends that run. */
    last: boolean
  }
  | { kind: 'date', dayStartMs: number, index: number }
  | {
    kind: 'membership'
    userName: string
    change: MembershipChangeKind
    atMs: number
    userId: string
    actorUserId: string | null
    index: number
  }

type MessageRow = Extract<Row, { kind: 'message' }>

/**
 * Turns timeline items into render rows in one pass. A run continues while
 * the previous item is a message of the same sender sent at most
 * `GROUP_GAP_MS` earlier; anything else starts a new run.
 */
export function groupTimeline(items: TimelineItem[]): Row[] {
  const rows: Row[] = []
  let previous: MessageRow | null = null
  items.forEach((entry, index) => {
    if (entry.type !== 'Message') {
      previous = null
      rows.push(entry.type === 'DateSeparator'
        ? { kind: 'date', dayStartMs: entry.dayStartMs, index }
        : {
            kind: 'membership',
            userName: entry.userName,
            change: entry.change,
            atMs: entry.atMs,
            userId: entry.userId,
            actorUserId: entry.actorUserId,
            index,
          })
      return
    }
    const { item } = entry
    const continues: boolean = previous !== null
      && previous.item.sender.userId === item.sender.userId
      && item.sentAtMs - previous.item.sentAtMs <= GROUP_GAP_MS
    if (continues)
      previous!.last = false
    const row: MessageRow = {
      kind: 'message',
      item,
      index,
      first: !continues,
      last: true,
    }
    rows.push(row)
    previous = row
  })
  return rows
}
