import type { MessageItem, SendState, TimelineItem, UserProfile } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import enChat from '@/i18n/locales/en/chat.json'
import { dispatchShortcut } from '@/lib/shortcuts'
import { chat, renderShell, resetChatList, SESSION } from '../test-utils'
import { timelineStore } from './store'

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

const ann: UserProfile = {
  userId: 'u-ann',
  handle: 'ann',
  displayName: 'Ann',
  hasAvatar: false,
}
const bob: UserProfile = {
  userId: 'u-bob',
  handle: 'bob',
  displayName: 'Bob',
  hasAvatar: false,
}
const self: UserProfile = {
  userId: SESSION.userId,
  handle: SESSION.handle,
  displayName: SESSION.displayName,
  hasAvatar: false,
}

const group = chat(CHAT_ID, { kind: 'Group', name: 'Team', memberCount: 3 })

function message(messageId: string, sender: UserProfile, sentAtMs: number, overrides: Partial<MessageItem> = {}): TimelineItem {
  const isOwn = sender.userId === self.userId
  return {
    type: 'Message',
    item: {
      messageId,
      chatId: CHAT_ID,
      sender,
      isOwn,
      sentAtMs,
      content: { type: 'Text', body: `body of ${messageId}` },
      replyTo: null,
      reactions: [],
      edited: false,
      sendState: isOwn
        ? { type: 'Sent' }
        : null,
      ...overrides,
    },
  }
}

const batch: TimelineItem[] = [
  { type: 'DateSeparator', dayStartMs: NOW },
  {
    type: 'MembershipChange',
    userName: 'Bob',
    change: 'Added',
    atMs: NOW,
    userId: bob.userId,
    actorUserId: ann.userId,
  },
  message('m1', ann, NOW),
  message('m2', ann, NOW + 60_000),
  message('m3', self, NOW + 120_000, {
    replyTo: { messageId: 'm1', senderName: 'Ann', text: 'body of m1' },
  }),
]

function resetTimeline(items: TimelineItem[] = batch): void {
  act(() => timelineStore.getState().applyTimelineDiffs(CHAT_ID, [
    { type: 'Reset', values: items },
  ]))
}

function setOwnState(sendState: SendState): void {
  act(() => timelineStore.getState().applyTimelineDiffs(CHAT_ID, [
    {
      type: 'Set',
      index: 4,
      value: message('m3', self, NOW + 120_000, { sendState }),
    },
  ]))
}

function calls(command: string) {
  return vi.mocked(invoke).mock.calls.filter(([name]) => name === command)
}

async function openPane(commands: Parameters<typeof renderShell>[1] = {}) {
  const router = renderShell(`/chats/${CHAT_ID}`, {
    chat_members: () => [ann, bob, self],
    paginate_backwards: () => false,
    ...commands,
  })
  // The first navigation loads the chat route chunk (pane and composer); allow for a busy machine.
  await screen.findByRole('textbox', { name: enChat.composer.placeholder }, { timeout: 5000 })
  await resetChatList([group])
  await waitFor(() => expect(calls('subscribe_timeline')).toHaveLength(1))
  return router
}

beforeEach(() => {
  virtualizer.scrollToIndex.mockClear()
})

describe('chat pane', () => {
  it('shows the chat name and member count in the header', async () => {
    await openPane()
    expect(await screen.findByRole('heading', { name: 'Team' })).toBeInTheDocument()
    expect(screen.getByText('3 members')).toBeInTheDocument()
  })

  it('renders a date separator, a membership change and grouped messages', async () => {
    await openPane()
    resetTimeline()

    expect(await screen.findByText(enChat.pane.today)).toBeInTheDocument()
    expect(await screen.findByText('Ann added Bob')).toBeInTheDocument()

    const rows = document.querySelectorAll('[data-message-id]')
    expect([...rows].map(row => row.getAttribute('data-message-id'))).toEqual(['m1', 'm2', 'm3'])
    const [m1, m2, m3] = rows
    expect(m1).toHaveAttribute('data-first', 'true')
    expect(m1).toHaveAttribute('data-last', 'false')
    expect(m2).toHaveAttribute('data-first', 'false')
    expect(m2).toHaveAttribute('data-last', 'true')
    expect(m3).toHaveAttribute('data-own', 'true')
    // The sender name shows once per run in groups.
    expect(within(m1 as HTMLElement).getByText('Ann')).toBeInTheDocument()
    expect(within(m2 as HTMLElement).queryByText('Ann')).not.toBeInTheDocument()
  })

  it('reflects each send state of an own message', async () => {
    await openPane()
    resetTimeline()
    const row = () => document.querySelector('[data-message-id="m3"]') as HTMLElement

    const cases: [SendState, string][] = [
      [
        { type: 'Pending' },
        enChat.pane.status.pending,
      ],
      [
        { type: 'Sent' },
        enChat.pane.status.sent,
      ],
      [
        { type: 'Delivered' },
        enChat.pane.status.delivered,
      ],
      [
        { type: 'Read' },
        enChat.pane.status.read,
      ],
      [
        { type: 'Failed', reason: 'x', cause: 'UserSuspended' },
        enChat.pane.status.failed,
      ],
    ]
    for (const [sendState, label] of cases) {
      setOwnState(sendState)
      expect(await within(row()).findByLabelText(label)).toBeInTheDocument()
    }
    expect(within(row()).getByText(enChat.actions.failed.suspended)).toBeInTheDocument()
    expect(within(row()).getByLabelText(enChat.pane.status.failed)).toHaveClass('text-destructive')
  })

  it('scrolls to the quoted message when the reply quote is clicked', async () => {
    await openPane()
    resetTimeline()
    const m3 = await waitFor(() => document.querySelector('[data-message-id="m3"]') as HTMLElement)
    virtualizer.scrollToIndex.mockClear()

    fireEvent.click(within(m3).getByRole('button', { name: /body of m1/ }))

    await waitFor(() => expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(2, { align: 'center' }))
    expect(document.querySelector('[data-message-id="m1"]')).toHaveAttribute('data-highlighted', 'true')
  })

  it('paginates backwards at the top and stops once there is no more history', async () => {
    await openPane()
    resetTimeline()

    expect(await screen.findByText(enChat.pane.startOfChat)).toBeInTheDocument()
    expect(calls('paginate_backwards')).toEqual([
      [
        'paginate_backwards',
        { chatId: CHAT_ID, count: 50 },
      ],
    ])

    act(() => timelineStore.getState().applyTimelineDiffs(CHAT_ID, [
      {
        type: 'PushBack',
        value: message('m4', ann, NOW + 180_000),
      },
    ]))
    await screen.findByText('body of m4')
    expect(calls('paginate_backwards')).toHaveLength(1)
  })

  it('renders the names of typing members', async () => {
    await openPane()
    resetTimeline()
    await screen.findByText('Ann added Bob')

    act(() => timelineStore.getState().setTyping(CHAT_ID, [ann.userId]))
    expect(await screen.findByText('Ann is typing…')).toBeInTheDocument()

    act(() => timelineStore.getState().setTyping(CHAT_ID, [ann.userId, bob.userId]))
    expect(await screen.findByText('Ann and Bob are typing…')).toBeInTheDocument()
  })

  it('reacts with a chip and removes an own reaction', async () => {
    await openPane()
    resetTimeline([
      message('m1', ann, NOW, {
        reactions: [
          { emoji: '👍', count: 2, own: true },
          { emoji: '🎉', count: 1, own: false },
        ],
      }),
    ])

    fireEvent.click(await screen.findByRole('button', { name: '👍 2' }))
    fireEvent.click(screen.getByRole('button', { name: '🎉 1' }))

    await waitFor(() => expect(calls('react')).toHaveLength(1))
    expect(calls('unreact')).toEqual([
      [
        'unreact',
        { chatId: CHAT_ID, messageId: 'm1', emoji: '👍' },
      ],
    ])
    expect(calls('react')).toEqual([
      [
        'react',
        { chatId: CHAT_ID, messageId: 'm1', emoji: '🎉' },
      ],
    ])
  })

  it('shows the load error for a chat that is not in the list', async () => {
    renderShell('/chats/chat-unknown')
    await resetChatList([group])
    expect(await screen.findByText(enChat.errors.loadFailed)).toBeInTheDocument()
  })

  it('goes back to the chat list with Escape', async () => {
    const router = await openPane()
    await screen.findByRole('heading', { name: 'Team' })
    act(() => {
      dispatchShortcut(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats'))
  })
})
