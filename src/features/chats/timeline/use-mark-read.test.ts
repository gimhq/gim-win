import type { TimelineItem } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { act, renderHook } from '@testing-library/react'
import { timelineStore } from './store'
import { useMarkRead } from './use-mark-read'

const CHAT_ID = 'chat-1'

function message(messageId: string): TimelineItem {
  return {
    type: 'Message',
    item: {
      messageId,
      chatId: CHAT_ID,
      sender: {
        userId: 'u-ann',
        handle: 'ann',
        displayName: 'Ann',
        hasAvatar: false,
      },
      isOwn: false,
      sentAtMs: 0,
      content: { type: 'Text', body: messageId },
      replyTo: null,
      reactions: [],
      edited: false,
      sendState: null,
    },
  }
}

let visibility: DocumentVisibilityState = 'visible'
let focused = true

function setActive(nextVisibility: DocumentVisibilityState, nextFocused: boolean): void {
  visibility = nextVisibility
  focused = nextFocused
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event(nextFocused
      ? 'focus'
      : 'blur'))
  })
}

function push(item: TimelineItem): void {
  act(() => timelineStore.getState().applyTimelineDiffs(CHAT_ID, [
    { type: 'PushBack', value: item },
  ]))
}

function markReadCalls() {
  return vi.mocked(invoke).mock.calls.filter(([name]) => name === 'mark_read')
}

beforeEach(() => {
  visibility = 'visible'
  focused = true
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused)
  vi.mocked(invoke).mockReset()
  vi.mocked(invoke).mockResolvedValue(null)
  timelineStore.setState({ byChat: {} })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useMarkRead', () => {
  it('marks each new last message once while visible and focused', () => {
    act(() => timelineStore.getState().applyTimelineDiffs(CHAT_ID, [
      {
        type: 'Reset',
        values: [
          message('m1'),
        ],
      },
    ]))
    const { rerender } = renderHook(() => useMarkRead(CHAT_ID))
    expect(markReadCalls()).toEqual([
      [
        'mark_read',
        { chatId: CHAT_ID, upToMessageId: 'm1' },
      ],
    ])

    rerender()
    push({ type: 'DateSeparator', dayStartMs: 0 })
    expect(markReadCalls()).toHaveLength(1)

    push(message('m2'))
    expect(markReadCalls()).toHaveLength(2)
    expect(markReadCalls()[1]).toEqual([
      'mark_read',
      { chatId: CHAT_ID, upToMessageId: 'm2' },
    ])
  })

  it('waits until the window is visible and focused', () => {
    visibility = 'hidden'
    focused = false
    act(() => timelineStore.getState().applyTimelineDiffs(CHAT_ID, [
      {
        type: 'Reset',
        values: [
          message('m1'),
        ],
      },
    ]))
    renderHook(() => useMarkRead(CHAT_ID))
    push(message('m2'))
    expect(markReadCalls()).toHaveLength(0)

    setActive('visible', false)
    expect(markReadCalls()).toHaveLength(0)

    setActive('visible', true)
    expect(markReadCalls()).toEqual([
      [
        'mark_read',
        { chatId: CHAT_ID, upToMessageId: 'm2' },
      ],
    ])

    setActive('hidden', false)
    push(message('m3'))
    expect(markReadCalls()).toHaveLength(1)
  })

  it('logs a failure instead of throwing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(invoke).mockRejectedValue({ kind: 'Network', message: 'offline', reason: 'offline' })
    act(() => timelineStore.getState().applyTimelineDiffs(CHAT_ID, [
      {
        type: 'Reset',
        values: [
          message('m1'),
        ],
      },
    ]))
    renderHook(() => useMarkRead(CHAT_ID))
    await vi.waitFor(() => expect(error).toHaveBeenCalled())
  })
})
