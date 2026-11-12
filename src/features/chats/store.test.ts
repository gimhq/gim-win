import type { EventCallback } from '@tauri-apps/api/event'
import type { ChatListDiff, ChatSummary } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { EVENT_CHAT_LIST_DIFF } from '@/lib/api'
import {
  chatListStore,
  selectChat,
  selectChatIds,
  selectChats,
  selectTotalUnread,
  useChatListStore,
} from './store'

const mockedInvoke = vi.mocked(invoke)
const mockedListen = vi.mocked(listen)

let handlers: Record<string, EventCallback<unknown>>
let unlisten: ReturnType<typeof vi.fn<() => void>>

function emit(event: string, payload: unknown): void {
  handlers[event]({ event, id: 1, payload })
}

function chat(chatId: string, overrides: Partial<ChatSummary> = {}): ChatSummary {
  return {
    chatId,
    kind: 'Group',
    name: chatId,
    avatar: null,
    lastMessage: null,
    unreadCount: 0,
    updatedAtMs: 0,
    memberCount: 2,
    state: 'Active',
    peer: null,
    isNoteToSelf: false,
    mutedUntilMs: 0,
    pinned: false,
    archived: false,
    blocked: false,
    ...overrides,
  }
}

const a = chat('a')
const b = chat('b')
const c = chat('c')
const d = chat('d')

function ids(): string[] {
  return chatListStore.getState().chats.map(x => x.chatId)
}

function apply(...diffs: ChatListDiff[]): void {
  chatListStore.getState().applyChatListDiffs(diffs)
}

beforeEach(() => {
  handlers = {}
  unlisten = vi.fn<() => void>()
  mockedInvoke.mockReset()
  mockedListen.mockReset()
  mockedListen.mockImplementation(async (event, handler) => {
    handlers[event] = handler as EventCallback<unknown>
    return unlisten
  })
  chatListStore.getState().reset()
})

afterEach(async () => {
  mockedInvoke.mockResolvedValue(undefined)
  await chatListStore.getState().stop()
})

describe('applyChatListDiffs', () => {
  beforeEach(() => apply({
    type: 'Reset',
    values: [a, b],
  }))

  it('reset replaces the list and marks the store ready', () => {
    chatListStore.getState().reset()
    expect(chatListStore.getState().status).toBe('idle')
    apply({
      type: 'Reset',
      values: [c],
    })
    expect(ids()).toEqual(['c'])
    expect(chatListStore.getState().status).toBe('ready')
  })

  it('append', () => {
    apply({
      type: 'Append',
      values: [c, d],
    })
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('clear', () => {
    apply({ type: 'Clear' })
    expect(ids()).toEqual([])
  })

  it('pushFront', () => {
    apply({ type: 'PushFront', value: c })
    expect(ids()).toEqual(['c', 'a', 'b'])
  })

  it('pushBack', () => {
    apply({ type: 'PushBack', value: c })
    expect(ids()).toEqual(['a', 'b', 'c'])
  })

  it('popFront', () => {
    apply({ type: 'PopFront' })
    expect(ids()).toEqual(['b'])
  })

  it('popBack', () => {
    apply({ type: 'PopBack' })
    expect(ids()).toEqual(['a'])
  })

  it('insert, including at index == length', () => {
    apply({ type: 'Insert', index: 1, value: c })
    expect(ids()).toEqual(['a', 'c', 'b'])
    apply({ type: 'Insert', index: 3, value: d })
    expect(ids()).toEqual(['a', 'c', 'b', 'd'])
  })

  it('set', () => {
    const updated = chat('b', { unreadCount: 4 })
    apply({ type: 'Set', index: 1, value: updated })
    expect(chatListStore.getState().chats[1]).toBe(updated)
  })

  it('remove', () => {
    apply({ type: 'Remove', index: 0 })
    expect(ids()).toEqual(['b'])
  })

  it('truncate', () => {
    apply({ type: 'Truncate', length: 1 })
    expect(ids()).toEqual(['a'])
  })

  it('resolves indices against the previous diff of the batch', () => {
    apply(
      { type: 'PushFront', value: c },
      { type: 'Remove', index: 1 },
      { type: 'Insert', index: 2, value: d },
      {
        type: 'Set',
        index: 0,
        value: chat('c', { name: 'C' }),
      },
    )
    expect(ids()).toEqual(['c', 'b', 'd'])
    expect(chatListStore.getState().chats[0].name).toBe('C')
  })

  it('replaces the chats array instead of mutating it', () => {
    const before = chatListStore.getState().chats
    apply({ type: 'PushBack', value: c })
    expect(chatListStore.getState().chats).not.toBe(before)
    expect(before.map(x => x.chatId)).toEqual(['a', 'b'])
  })
})

describe('selectors', () => {
  it('select chats, a chat and the ordered ids', () => {
    apply({
      type: 'Reset',
      values: [b, a],
    })
    const state = chatListStore.getState()
    expect(selectChats(state)).toEqual([b, a])
    expect(selectChat('a')(state)).toBe(a)
    expect(selectChat('zz')(state)).toBeNull()
    expect(selectChatIds(state)).toEqual(['b', 'a'])
    // Stable for the same list, so it can be used directly as a hook selector.
    expect(selectChatIds(state)).toBe(selectChatIds(chatListStore.getState()))
  })

  it('pins the note to self on top of the list and the ids', () => {
    useChatListStore.getState().applyChatListDiffs([
      {
        type: 'Reset',
        values: [
          chat('a'),
          chat('note', { isNoteToSelf: true }),
          chat('b'),
        ],
      },
    ])
    const state = chatListStore.getState()
    expect(selectChats(state).map(c => c.chatId)).toEqual(['note', 'a', 'b'])
    expect(selectChats(state)).toBe(selectChats(chatListStore.getState()))
    expect(selectChatIds(state)).toEqual(['note', 'a', 'b'])
  })

  it('selectTotalUnread sums unread counts and ignores archived and Left chats', () => {
    apply({
      type: 'Reset',
      values: [
        chat('a', { unreadCount: 2 }),
        chat('b', { unreadCount: 3, state: 'Leaving' }),
        chat('c', { unreadCount: 10, state: 'Left' }),
        chat('d', { unreadCount: 7, archived: true }),
      ],
    })
    expect(selectTotalUnread(chatListStore.getState())).toBe(5)
  })

  it('useChatListStore is the vanilla store api', () => {
    expect(useChatListStore.getState).toBe(chatListStore.getState)
    expect(typeof chatListStore.subscribe).toBe('function')
  })
})

describe('start and stop', () => {
  it('owns exactly one subscription and feeds its diffs into the store', async () => {
    mockedInvoke.mockResolvedValueOnce('s1')
    const store = chatListStore.getState()
    const first = store.start()
    expect(chatListStore.getState().status).toBe('loading')
    await Promise.all([
      first,
      store.start(),
    ])
    await store.start()
    expect(mockedInvoke.mock.calls.filter(([cmd]) => cmd === 'subscribe_chat_list')).toHaveLength(1)

    emit(EVENT_CHAT_LIST_DIFF, {
      subscriptionId: 's1',
      diffs: [
        {
          type: 'Reset',
          values: [a],
        },
      ],
    })
    expect(ids()).toEqual(['a'])
    expect(chatListStore.getState().status).toBe('ready')
  })

  it('stop ends the subscription once; a later start subscribes again', async () => {
    mockedInvoke.mockResolvedValueOnce('s1')
    await chatListStore.getState().start()
    mockedInvoke.mockResolvedValue(undefined)
    await chatListStore.getState().stop()
    await chatListStore.getState().stop()
    expect(unlisten).toHaveBeenCalledTimes(1)
    expect(mockedInvoke.mock.calls.filter(([cmd]) => cmd === 'unsubscribe')).toEqual([
      [
        'unsubscribe',
        { subscriptionId: 's1' },
      ],
    ])

    mockedInvoke.mockResolvedValueOnce('s2')
    await chatListStore.getState().start()
    expect(mockedInvoke).toHaveBeenLastCalledWith('subscribe_chat_list', undefined)
  })

  it('stop during a pending start ends the subscription once it exists', async () => {
    let resolveId: (id: string) => void = () => {}
    mockedInvoke.mockReturnValueOnce(new Promise<string>((resolve) => {
      resolveId = resolve
    }))
    const started = chatListStore.getState().start()
    mockedInvoke.mockResolvedValue(undefined)
    const stopped = chatListStore.getState().stop()
    resolveId('s1')
    await Promise.all([started, stopped])
    expect(mockedInvoke).toHaveBeenLastCalledWith('unsubscribe', { subscriptionId: 's1' })
  })

  it('a failed start sets status error and can be retried', async () => {
    const error = { kind: 'NotRegistered', message: 'no session' }
    mockedInvoke.mockRejectedValueOnce(error)
    await chatListStore.getState().start()
    expect(chatListStore.getState().status).toBe('error')
    expect(chatListStore.getState().error).toEqual(error)

    mockedInvoke.mockResolvedValueOnce('s2')
    await chatListStore.getState().start()
    expect(chatListStore.getState().status).toBe('loading')
    expect(chatListStore.getState().error).toBeNull()
  })

  it('wraps a non-bridge error as Internal', async () => {
    mockedListen.mockRejectedValueOnce(new Error('boom'))
    await chatListStore.getState().start()
    expect(chatListStore.getState().error).toMatchObject({ kind: 'Internal' })
  })
})
