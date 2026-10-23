import type { SearchResults, TimelineItem } from '@/lib/api'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import enChat from '@/i18n/locales/en/chat.json'
import { dispatchShortcut } from '@/lib/shortcuts'
import { chat, renderShell, resetChatList } from '../test-utils'
import { timelineStore } from '../timeline/store'
import { callsOf } from '../timeline/test-render'

interface FakeVirtualizerOptions {
  count: number
  getItemKey: (index: number) => string | number
}

// jsdom has no layout: the fake virtualizer renders every row at a fixed size.
const virtualizer = vi.hoisted(() => ({
  scrollToIndex: vi.fn(),
}))
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: FakeVirtualizerOptions) => ({
    getVirtualItems: () => Array.from({ length: options.count }, (_, index) => ({
      index,
      key: options.getItemKey(index),
      start: index * 50,
      end: (index + 1) * 50,
      size: 50,
      lane: 0,
    })),
    getTotalSize: () => options.count * 50,
    measureElement: () => {},
    scrollToIndex: virtualizer.scrollToIndex,
  }),
}))

const NOW = Date.now()
const CHAT_ID = 'chat-g'

function message(messageId: string, sentAtMs: number): TimelineItem {
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
      sentAtMs,
      content: { type: 'Text', body: `body of ${messageId}` },
      replyTo: null,
      reactions: [],
      edited: false,
      sendState: null,
    },
  }
}

const results: SearchResults = {
  chats: [],
  messages: [
    {
      chatId: CHAT_ID,
      messageId: 'm3',
      senderName: 'Ann',
      snippet: 'body of m3',
      sentAtMs: NOW + 2,
    },
    {
      chatId: 'chat-other',
      messageId: 'x1',
      senderName: 'Bob',
      snippet: 'body',
      sentAtMs: NOW + 3,
    },
    {
      chatId: CHAT_ID,
      messageId: 'm1',
      senderName: 'Ann',
      snippet: 'body of m1',
      sentAtMs: NOW,
    },
  ],
}

function press(key: string, init: KeyboardEventInit = {}): void {
  act(() => {
    dispatchShortcut(new KeyboardEvent('keydown', { key, ...init }))
  })
}

function resetTimeline(items: TimelineItem[]): void {
  act(() => timelineStore.getState().applyTimelineDiffs(CHAT_ID, [
    { type: 'Reset', values: items },
  ]))
}

function row(messageId: string): HTMLElement | null {
  return document.querySelector(`[data-message-id="${messageId}"]`)
}

async function openChat(path: string, commands: Parameters<typeof renderShell>[1] = {}) {
  const router = renderShell(path, {
    paginate_backwards: () => false,
    search: () => results,
    ...commands,
  })
  await screen.findByRole('textbox', { name: enChat.composer.placeholder }, { timeout: 5000 })
  await resetChatList([
    chat(CHAT_ID, { kind: 'Group', name: 'Team' }),
  ])
  await waitFor(() => expect(callsOf('subscribe_timeline')).toHaveLength(1))
  return router
}

beforeEach(() => {
  virtualizer.scrollToIndex.mockClear()
})

describe('in-chat search', () => {
  it('does not open outside a chat', async () => {
    renderShell('/chats')
    await resetChatList([
      chat(CHAT_ID),
    ])
    press('f', { ctrlKey: true })
    expect(screen.queryByRole('textbox', { name: enChat.search.inChatPlaceholder })).not.toBeInTheDocument()
  })

  it('finds the chat\'s messages oldest to newest and steps through them', async () => {
    const router = await openChat(`/chats/${CHAT_ID}`)
    resetTimeline([
      message('m1', NOW),
      message('m2', NOW + 1),
      message('m3', NOW + 2),
    ])
    await waitFor(() => expect(row('m3')).not.toBeNull())

    press('f', { ctrlKey: true })
    const input = await screen.findByRole('textbox', { name: enChat.search.inChatPlaceholder })
    fireEvent.change(input, {
      target: { value: 'body' },
    })

    // Starts at the newest hit.
    expect(await screen.findByText('2 of 2')).toBeInTheDocument()
    expect(callsOf('search')).toEqual([
      { query: 'body', limit: 100 },
    ])
    await waitFor(() => expect(row('m3')).toHaveAttribute('data-highlighted', 'true'))

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(await screen.findByText('1 of 2')).toBeInTheDocument()
    await waitFor(() => expect(row('m1')).toHaveAttribute('data-highlighted', 'true'))
    expect(virtualizer.scrollToIndex).toHaveBeenLastCalledWith(expect.any(Number), { align: 'center' })

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('2 of 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: enChat.search.next }))
    expect(await screen.findByText('1 of 2')).toBeInTheDocument()

    press('Escape')
    await waitFor(() => expect(screen.queryByRole('textbox', { name: enChat.search.inChatPlaceholder })).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe(`/chats/${CHAT_ID}`)
  })

  it('scrolls to the message param, loading older history, then clears it', async () => {
    let pages = 0
    const router = await openChat(`/chats/${CHAT_ID}?message=m0`, {
      paginate_backwards: () => {
        pages += 1
        if (pages < 3)
          return true
        act(() => timelineStore.getState().applyTimelineDiffs(CHAT_ID, [
          {
            type: 'PushFront',
            value: message('m0', NOW - 1),
          },
        ]))
        return false
      },
    })
    resetTimeline([
      message('m1', NOW),
      message('m2', NOW + 1),
    ])

    await waitFor(() => expect(row('m0')).toHaveAttribute('data-highlighted', 'true'))
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(0, { align: 'center' })
    await waitFor(() => expect(router.state.location.search).toEqual({}))
    expect(within(screen.getByRole('main')).getByText('body of m0')).toBeInTheDocument()
  })
})
