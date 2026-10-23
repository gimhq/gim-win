import type { EventCallback } from '@tauri-apps/api/event'
import type { MessageItem, SendState, TimelineDiff, TimelineItem } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { EVENT_TIMELINE_DIFF, EVENT_TYPING } from '@/lib/api'
import {
  selectItems,
  selectLastMessage,
  selectMessageIndex,
  selectTimeline,
  selectTyping,
  timelineStore,
} from './store'

const mockedInvoke = vi.mocked(invoke)
const mockedListen = vi.mocked(listen)

/** Every handler registered through `listen`, by event name. */
let handlers: Record<string, EventCallback<unknown>[]>
let unlisten: ReturnType<typeof vi.fn<() => void>>
/** Result of the next `paginate_backwards` call. */
let paginate: () => Promise<boolean>

function emit(event: string, payload: unknown): void {
  for (const handler of handlers[event] ?? [])
    handler({ event, id: 1, payload })
}

function calls(command: string): unknown[][] {
  return mockedInvoke.mock.calls.filter(([cmd]) => cmd === command)
}

function message(messageId: string, sendState: SendState | null = null): TimelineItem {
  const item: MessageItem = {
    messageId,
    chatId: 'c1',
    sender: {
      userId: 'u1',
      handle: '',
      displayName: 'U',
      hasAvatar: false,
    },
    isOwn: sendState !== null,
    sentAtMs: 0,
    content: { type: 'Text', body: messageId },
    replyTo: null,
    reactions: [],
    edited: false,
    sendState,
  }
  return { type: 'Message', item }
}

const day: TimelineItem = { type: 'DateSeparator', dayStartMs: 0 }
const m1 = message('m1')
const m2 = message('m2')
const m3 = message('m3')
const m4 = message('m4')

function ids(chatId = 'c1'): string[] {
  return selectItems(chatId)(timelineStore.getState())
    .map(x => x.type === 'Message'
      ? x.item.messageId
      : x.type)
}

function apply(...diffs: TimelineDiff[]): void {
  timelineStore.getState().applyTimelineDiffs('c1', diffs)
}

beforeEach(() => {
  handlers = {}
  unlisten = vi.fn<() => void>()
  paginate = async () => true
  mockedInvoke.mockReset()
  mockedListen.mockReset()
  mockedListen.mockImplementation(async (event, handler) => {
    (handlers[event] ??= []).push(handler as EventCallback<unknown>)
    return unlisten
  })
  mockedInvoke.mockImplementation(async (command, args) => {
    const chatId = (args as { chatId?: string } | undefined)?.chatId
    switch (command) {
      case 'subscribe_timeline':
        return `t-${chatId}`
      case 'subscribe_typing':
        return `y-${chatId}`
      case 'paginate_backwards':
        return paginate()
      default:
        return undefined
    }
  })
})

afterEach(async () => {
  const { byChat, close } = timelineStore.getState()
  await Promise.all(Object.keys(byChat).map(chatId => close(chatId)))
  timelineStore.setState({ byChat: {} })
})

describe('applyTimelineDiffs', () => {
  beforeEach(() => apply({
    type: 'Reset',
    values: [m1, m2],
  }))

  it('reset replaces the items and marks the chat ready', () => {
    expect(ids()).toEqual(['m1', 'm2'])
    expect(selectTimeline('c1')(timelineStore.getState())).toMatchObject({
      status: 'ready',
      error: null,
      hasMore: true,
      paginating: false,
      typing: [],
    })
  })

  it('append', () => {
    apply({
      type: 'Append',
      values: [m3, m4],
    })
    expect(ids()).toEqual(['m1', 'm2', 'm3', 'm4'])
  })

  it('clear', () => {
    apply({ type: 'Clear' })
    expect(ids()).toEqual([])
  })

  it('pushFront', () => {
    apply({ type: 'PushFront', value: day })
    expect(ids()).toEqual(['DateSeparator', 'm1', 'm2'])
  })

  it('pushBack', () => {
    apply({ type: 'PushBack', value: m3 })
    expect(ids()).toEqual(['m1', 'm2', 'm3'])
  })

  it('popFront', () => {
    apply({ type: 'PopFront' })
    expect(ids()).toEqual(['m2'])
  })

  it('popBack', () => {
    apply({ type: 'PopBack' })
    expect(ids()).toEqual(['m1'])
  })

  it('insert, including at index == length', () => {
    apply({ type: 'Insert', index: 0, value: day })
    apply({ type: 'Insert', index: 3, value: m3 })
    expect(ids()).toEqual(['DateSeparator', 'm1', 'm2', 'm3'])
  })

  it('set replaces the sendState of a message', () => {
    apply({
      type: 'Reset',
      values: [
        message('m1', { type: 'Pending' }),
      ],
    })
    apply({
      type: 'Set',
      index: 0,
      value: message('m1', { type: 'Sent' }),
    })
    const last = selectLastMessage('c1')(timelineStore.getState())
    expect(last?.sendState).toEqual({ type: 'Sent' })
  })

  it('remove', () => {
    apply({ type: 'Remove', index: 1 })
    expect(ids()).toEqual(['m1'])
  })

  it('truncate', () => {
    apply({ type: 'Truncate', length: 1 })
    expect(ids()).toEqual(['m1'])
  })

  it('resolves indices against the previous diff of the batch', () => {
    apply(
      { type: 'PushFront', value: day },
      { type: 'Remove', index: 2 },
      { type: 'Insert', index: 2, value: m3 },
    )
    expect(ids()).toEqual(['DateSeparator', 'm1', 'm3'])
  })

  it('keeps chats apart', () => {
    timelineStore.getState().applyTimelineDiffs('c2', [
      {
        type: 'Reset',
        values: [m4],
      },
    ])
    expect(ids('c1')).toEqual(['m1', 'm2'])
    expect(ids('c2')).toEqual(['m4'])
  })
})

describe('selectors', () => {
  it('return stable defaults for an unknown chat', () => {
    const state = timelineStore.getState()
    expect(selectTimeline('nope')(state)).toBeNull()
    expect(selectItems('nope')(state)).toEqual([])
    expect(selectItems('nope')(state)).toBe(selectItems('other')(state))
    expect(selectTyping('nope')(state)).toBe(selectTyping('other')(state))
    expect(selectLastMessage('nope')(state)).toBeNull()
    expect(selectMessageIndex('nope', 'm1')(state)).toBe(-1)
  })

  it('selectLastMessage skips trailing non-message items', () => {
    apply({
      type: 'Reset',
      values: [m1, m2, day],
    })
    expect(selectLastMessage('c1')(timelineStore.getState())).toBe((m2 as Extract<TimelineItem, { type: 'Message' }>).item)
    apply({
      type: 'Reset',
      values: [day],
    })
    expect(selectLastMessage('c1')(timelineStore.getState())).toBeNull()
  })

  it('selectMessageIndex finds the item index', () => {
    apply({
      type: 'Reset',
      values: [day, m1, m2],
    })
    const state = timelineStore.getState()
    expect(selectMessageIndex('c1', 'm2')(state)).toBe(2)
    expect(selectMessageIndex('c1', 'zz')(state)).toBe(-1)
  })

  it('selectTyping returns the typing user ids', () => {
    timelineStore.getState().setTyping('c1', ['u2', 'u3'])
    expect(selectTyping('c1')(timelineStore.getState())).toEqual(['u2', 'u3'])
  })
})

describe('open and close', () => {
  it('owns one timeline and one typing subscription per chat', async () => {
    const { open } = timelineStore.getState()
    const first = open('c1')
    expect(selectTimeline('c1')(timelineStore.getState())?.status).toBe('loading')
    await Promise.all([
      first,
      open('c1'),
    ])
    await open('c1')
    expect(calls('subscribe_timeline')).toEqual([
      [
        'subscribe_timeline',
        { chatId: 'c1' },
      ],
    ])
    expect(calls('subscribe_typing')).toEqual([
      [
        'subscribe_typing',
        { chatId: 'c1' },
      ],
    ])

    emit(EVENT_TIMELINE_DIFF, {
      subscriptionId: 't-c1',
      chatId: 'c1',
      diffs: [
        {
          type: 'Reset',
          values: [m1],
        },
      ],
    })
    emit(EVENT_TYPING, {
      subscriptionId: 'y-c1',
      chatId: 'c1',
      userIds: ['u2'],
    })
    expect(ids()).toEqual(['m1'])
    expect(selectTimeline('c1')(timelineStore.getState())?.status).toBe('ready')
    expect(selectTyping('c1')(timelineStore.getState())).toEqual(['u2'])

    await open('c2')
    expect(calls('subscribe_timeline')).toHaveLength(2)
  })

  it('close unsubscribes both streams once and keeps the items', async () => {
    await timelineStore.getState().open('c1')
    emit(EVENT_TIMELINE_DIFF, {
      subscriptionId: 't-c1',
      chatId: 'c1',
      diffs: [
        {
          type: 'Reset',
          values: [m1],
        },
      ],
    })
    await timelineStore.getState().close('c1')
    await timelineStore.getState().close('c1')
    expect(calls('unsubscribe')).toEqual([
      [
        'unsubscribe',
        { subscriptionId: 't-c1' },
      ],
      [
        'unsubscribe',
        { subscriptionId: 'y-c1' },
      ],
    ])
    expect(unlisten).toHaveBeenCalledTimes(2)
    expect(ids()).toEqual(['m1'])

    await timelineStore.getState().open('c1')
    expect(calls('subscribe_timeline')).toHaveLength(2)
  })

  it('a failed open sets status error, ends the other stream and can be retried', async () => {
    const error = { kind: 'NotFound', message: 'no chat', reason: 'x' }
    const base = mockedInvoke.getMockImplementation()!
    mockedInvoke.mockImplementation(async (command, args) => {
      if (command === 'subscribe_typing')
        throw error
      return base(command, args)
    })
    await timelineStore.getState().open('c1')
    expect(selectTimeline('c1')(timelineStore.getState())).toMatchObject({ status: 'error', error })
    expect(calls('unsubscribe')).toEqual([
      [
        'unsubscribe',
        { subscriptionId: 't-c1' },
      ],
    ])

    mockedInvoke.mockImplementation(base)
    await timelineStore.getState().open('c1')
    expect(selectTimeline('c1')(timelineStore.getState())).toMatchObject({ status: 'loading', error: null })
  })
})

describe('paginateBackwards', () => {
  it('calls the bridge with a default count and stores hasMore', async () => {
    paginate = async () => false
    await expect(timelineStore.getState().paginateBackwards('c1')).resolves.toBe(false)
    expect(calls('paginate_backwards')).toEqual([
      [
        'paginate_backwards',
        { chatId: 'c1', count: 50 },
      ],
    ])
    expect(selectTimeline('c1')(timelineStore.getState())).toMatchObject({ hasMore: false, paginating: false })
  })

  it('passes a custom count', async () => {
    await expect(timelineStore.getState().paginateBackwards('c1', 20)).resolves.toBe(true)
    expect(calls('paginate_backwards')).toEqual([
      [
        'paginate_backwards',
        { chatId: 'c1', count: 20 },
      ],
    ])
    expect(selectTimeline('c1')(timelineStore.getState())?.hasMore).toBe(true)
  })

  it('does not re-enter while a page is loading', async () => {
    let resolve: (more: boolean) => void = () => {}
    paginate = () => new Promise((r) => {
      resolve = r
    })
    const first = timelineStore.getState().paginateBackwards('c1')
    expect(selectTimeline('c1')(timelineStore.getState())?.paginating).toBe(true)
    await expect(timelineStore.getState().paginateBackwards('c1')).resolves.toBe(true)
    expect(calls('paginate_backwards')).toHaveLength(1)

    resolve(false)
    await expect(first).resolves.toBe(false)
    expect(selectTimeline('c1')(timelineStore.getState())).toMatchObject({ hasMore: false, paginating: false })
  })

  it('clears paginating and rethrows on failure', async () => {
    const error = { kind: 'Network', message: 'down', reason: 'x' }
    paginate = async () => {
      throw error
    }
    await expect(timelineStore.getState().paginateBackwards('c1')).rejects.toEqual(error)
    expect(selectTimeline('c1')(timelineStore.getState())).toMatchObject({ paginating: false, hasMore: true })
  })
})
