import type { EventCallback } from '@tauri-apps/api/event'
import type { Mock } from 'vitest'
import type { ChatSummary, HubInfo, VectorDiff } from './types'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  applyDiffs,
  EVENT_CHAT_LIST_DIFF,
  EVENT_CONNECTION_STATE,
  EVENT_HUB_LIST,
  EVENT_TIMELINE_DIFF,
  EVENT_TYPING,
  subscribeChatList,
  subscribeConnectionState,
  subscribeHubList,
  subscribeTimeline,
  subscribeTyping,
} from './events'

vi.mock('@tauri-apps/api/core')
vi.mock('@tauri-apps/api/event')

const mockedInvoke = vi.mocked(invoke)
const mockedListen = vi.mocked(listen)

/** The handlers registered through `listen`, by event name. */
let handlers: Record<string, EventCallback<unknown>>
let unlisten: Mock<() => void>

function emit(event: string, payload: unknown): void {
  handlers[event]({ event, id: 1, payload })
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
})

const reset: VectorDiff<ChatSummary> = { type: 'Reset', values: [] }
const clear: VectorDiff<ChatSummary> = { type: 'Clear' }

describe('subscribeChatList', () => {
  it('listens, invokes the subscribe command and forwards matching events in order', async () => {
    mockedInvoke.mockResolvedValueOnce('s1')
    const onDiffs = vi.fn()
    await subscribeChatList(onDiffs)

    expect(mockedListen).toHaveBeenCalledWith(EVENT_CHAT_LIST_DIFF, expect.any(Function))
    expect(mockedInvoke).toHaveBeenCalledWith('subscribe_chat_list', undefined)

    emit(EVENT_CHAT_LIST_DIFF, {
      subscriptionId: 's1',
      diffs: [reset],
    })
    emit(EVENT_CHAT_LIST_DIFF, {
      subscriptionId: 'other',
      diffs: [clear],
    })
    emit(EVENT_CHAT_LIST_DIFF, {
      subscriptionId: 's1',
      diffs: [clear],
    })

    expect(onDiffs.mock.calls).toEqual([
      [
        [reset],
      ],
      [
        [clear],
      ],
    ])
  })

  it('buffers events that arrive before the subscription id is known', async () => {
    let resolveId: (id: string) => void = () => {}
    mockedInvoke.mockReturnValueOnce(new Promise<string>((resolve) => {
      resolveId = resolve
    }))
    const onDiffs = vi.fn()
    const pending = subscribeChatList(onDiffs)
    await vi.waitFor(() => expect(handlers[EVENT_CHAT_LIST_DIFF]).toBeDefined())

    emit(EVENT_CHAT_LIST_DIFF, {
      subscriptionId: 's1',
      diffs: [reset],
    })
    emit(EVENT_CHAT_LIST_DIFF, {
      subscriptionId: 'stale',
      diffs: [clear],
    })
    expect(onDiffs).not.toHaveBeenCalled()

    resolveId('s1')
    await pending
    expect(onDiffs.mock.calls).toEqual([
      [
        [reset],
      ],
    ])

    emit(EVENT_CHAT_LIST_DIFF, {
      subscriptionId: 's1',
      diffs: [clear],
    })
    expect(onDiffs.mock.calls).toEqual([
      [
        [reset],
      ],
      [
        [clear],
      ],
    ])
  })

  it('unsubscribe stops listening and invokes the unsubscribe command', async () => {
    mockedInvoke.mockResolvedValueOnce('s1')
    const stop = await subscribeChatList(vi.fn())
    mockedInvoke.mockResolvedValueOnce(undefined)
    await stop()
    expect(unlisten).toHaveBeenCalledTimes(1)
    expect(mockedInvoke).toHaveBeenLastCalledWith('unsubscribe', { subscriptionId: 's1' })
  })

  it('stops listening when the subscribe command fails', async () => {
    const error = { kind: 'NotRegistered', message: 'no session' }
    mockedInvoke.mockRejectedValueOnce(error)
    await expect(subscribeChatList(vi.fn())).rejects.toBe(error)
    expect(unlisten).toHaveBeenCalledTimes(1)
  })
})

describe('other streams', () => {
  it('subscribeTimeline passes chatId and forwards diffs', async () => {
    mockedInvoke.mockResolvedValueOnce('t1')
    const onDiffs = vi.fn()
    await subscribeTimeline('c1', onDiffs)
    expect(mockedInvoke).toHaveBeenCalledWith('subscribe_timeline', { chatId: 'c1' })
    const diffs = [
      { type: 'Reset', values: [] },
    ]
    emit(EVENT_TIMELINE_DIFF, { subscriptionId: 't1', chatId: 'c1', diffs })
    expect(onDiffs).toHaveBeenCalledWith(diffs)
  })

  it('subscribeConnectionState forwards the state', async () => {
    mockedInvoke.mockResolvedValueOnce('k1')
    const onChange = vi.fn()
    await subscribeConnectionState(onChange)
    expect(mockedInvoke).toHaveBeenCalledWith('subscribe_connection_state', undefined)
    emit(EVENT_CONNECTION_STATE, { subscriptionId: 'k1', state: 'Syncing' })
    expect(onChange).toHaveBeenCalledWith('Syncing')
  })

  it('subscribeTyping passes chatId and forwards the user ids', async () => {
    mockedInvoke.mockResolvedValueOnce('y1')
    const onUpdate = vi.fn()
    await subscribeTyping('c1', onUpdate)
    expect(mockedInvoke).toHaveBeenCalledWith('subscribe_typing', { chatId: 'c1' })
    emit(EVENT_TYPING, {
      subscriptionId: 'y1',
      chatId: 'c1',
      userIds: ['u2'],
    })
    expect(onUpdate).toHaveBeenCalledWith(['u2'])
  })

  it('subscribeHubList forwards the hubs', async () => {
    mockedInvoke.mockResolvedValueOnce('h1')
    const onUpdate = vi.fn()
    await subscribeHubList(onUpdate)
    expect(mockedInvoke).toHaveBeenCalledWith('subscribe_hub_list', undefined)
    const hubs: HubInfo[] = [
      {
        hubId: 'hub-a',
        url: 'https://a',
        state: 'Verified',
        priority: 0,
        isPrimary: true,
        isHome: true,
        signedIn: true,
      },
    ]
    emit(EVENT_HUB_LIST, { subscriptionId: 'h1', hubs })
    expect(onUpdate).toHaveBeenCalledWith(hubs)
  })
})

describe('applyDiffs', () => {
  it('applies every diff kind in order against the updated list', () => {
    let list: string[] = []
    const step = (diff: VectorDiff<string>): string[] => {
      list = applyDiffs(list, [diff])
      return list
    }
    expect(step({
      type: 'Reset',
      values: ['a', 'b'],
    })).toEqual(['a', 'b'])
    expect(step({
      type: 'Append',
      values: ['c', 'd'],
    })).toEqual(['a', 'b', 'c', 'd'])
    expect(step({ type: 'PushFront', value: 'z' })).toEqual(['z', 'a', 'b', 'c', 'd'])
    expect(step({ type: 'PushBack', value: 'e' })).toEqual(['z', 'a', 'b', 'c', 'd', 'e'])
    expect(step({ type: 'PopFront' })).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(step({ type: 'PopBack' })).toEqual(['a', 'b', 'c', 'd'])
    expect(step({ type: 'Insert', index: 1, value: 'x' })).toEqual(['a', 'x', 'b', 'c', 'd'])
    // Insert at index == length appends.
    expect(step({ type: 'Insert', index: 5, value: 'y' })).toEqual(['a', 'x', 'b', 'c', 'd', 'y'])
    expect(step({ type: 'Set', index: 1, value: 'X' })).toEqual(['a', 'X', 'b', 'c', 'd', 'y'])
    expect(step({ type: 'Remove', index: 0 })).toEqual(['X', 'b', 'c', 'd', 'y'])
    expect(step({ type: 'Truncate', length: 2 })).toEqual(['X', 'b'])
    expect(step({ type: 'Clear' })).toEqual([])
  })

  it('resolves indices against the list after the previous diff of the batch', () => {
    const result = applyDiffs(['a', 'b'], [
      { type: 'PushFront', value: 'z' },
      { type: 'Set', index: 0, value: 'Z' },
      { type: 'Remove', index: 2 },
      { type: 'Insert', index: 2, value: 'c' },
    ])
    expect(result).toEqual(['Z', 'a', 'c'])
  })

  it('does not modify the input list', () => {
    const input = ['a']
    applyDiffs(input, [
      { type: 'Clear' },
    ])
    expect(input).toEqual(['a'])
  })
})
