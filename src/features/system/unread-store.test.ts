import type { EventCallback } from '@tauri-apps/api/event'
import type { ChatListDiff, ChatSummary } from '@/lib/api/types'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { EVENT_CHAT_LIST_DIFF } from '@/lib/api/events'
import { selectUnreadTotal, useUnreadStore } from './unread-store'

const mockedInvoke = vi.mocked(invoke)
const mockedListen = vi.mocked(listen)

/** A chat list entry for tests; `overrides` replaces any field. */
function chatSummary(chatId: string, overrides: Partial<ChatSummary> = {}): ChatSummary {
  return {
    chatId,
    kind: 'Direct',
    name: `Chat ${chatId}`,
    avatar: null,
    lastMessage: null,
    unreadCount: 0,
    updatedAtMs: 0,
    memberCount: 2,
    state: 'Active',
    peer: null,
    mutedUntilMs: 0,
    pinned: false,
    archived: false,
    blocked: false,
    ...overrides,
  }
}

let handler: EventCallback<unknown>

function emitDiffs(diffs: ChatListDiff[]): void {
  handler({
    event: EVENT_CHAT_LIST_DIFF,
    id: 1,
    payload: { subscriptionId: 's1', diffs },
  })
}

function badgeCalls(): unknown[] {
  return mockedInvoke.mock.calls.filter(([command]) => command === 'set_badge_count').map(([, args]) => args)
}

beforeEach(() => {
  useUnreadStore.setState({ chats: [], unreadTotal: 0 })
  mockedInvoke.mockReset()
  mockedInvoke.mockImplementation(async command => command === 'subscribe_chat_list'
    ? 's1'
    : null)
  mockedListen.mockReset()
  mockedListen.mockImplementation(async (_event, h) => {
    handler = h as EventCallback<unknown>
    return () => {}
  })
})

describe('useUnreadStore', () => {
  it('sums the unread counts and follows them on the badge', async () => {
    await useUnreadStore.getState().start()

    const a: ChatSummary = chatSummary('a', { unreadCount: 2 })
    const b: ChatSummary = chatSummary('b', { unreadCount: 3 })
    emitDiffs([
      {
        type: 'Reset',
        values: [a, b],
      },
    ])
    expect(selectUnreadTotal(useUnreadStore.getState())).toBe(5)
    expect(badgeCalls()).toEqual([
      { count: 5 },
    ])

    emitDiffs([
      {
        type: 'Set',
        index: 0,
        value: { ...a, unreadCount: 0 },
      },
    ])
    expect(selectUnreadTotal(useUnreadStore.getState())).toBe(3)
    expect(badgeCalls()).toEqual([
      { count: 5 },
      { count: 3 },
    ])

    emitDiffs([
      {
        type: 'Set',
        index: 0,
        value: { ...a, unreadCount: 0, name: 'Renamed' },
      },
    ])
    expect(badgeCalls()).toEqual([
      { count: 5 },
      { count: 3 },
    ])
  })

  it('sets the badge on the first reset even when the total is 0', async () => {
    await useUnreadStore.getState().start()
    emitDiffs([
      { type: 'Reset', values: [] },
    ])
    expect(badgeCalls()).toEqual([
      { count: 0 },
    ])
  })

  it('leaves archived chats out of the total', async () => {
    await useUnreadStore.getState().start()
    emitDiffs([
      {
        type: 'Reset',
        values: [
          chatSummary('a', { unreadCount: 2 }),
          chatSummary('b', { unreadCount: 4, archived: true }),
        ],
      },
    ])
    expect(useUnreadStore.getState().unreadTotal).toBe(2)
  })
})
