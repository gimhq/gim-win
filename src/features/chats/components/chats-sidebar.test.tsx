import type { MessageItem } from '@/lib/api'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import enChat from '@/i18n/locales/en/chat.json'
import { dispatchShortcut } from '@/lib/shortcuts'
import { chat, renderShell, resetChatList } from '../test-utils'
import { timelineStore } from '../timeline/store'

const NOW = Date.now()

const general = chat('chat-general', {
  kind: 'Group',
  name: 'General',
  unreadCount: 3,
  pinned: true,
  mutedUntilMs: Number.MAX_SAFE_INTEGER,
  lastMessage: {
    senderName: 'Roy',
    text: 'See you there',
    sentAtMs: NOW,
    isOwn: true,
  },
  updatedAtMs: NOW,
})
const old = chat('chat-old', { name: 'Old team', state: 'Left', updatedAtMs: NOW - 1000 })

function ownMessage(sendState: MessageItem['sendState']): MessageItem {
  return {
    messageId: 'm1',
    chatId: general.chatId,
    sender: {
      userId: 'u-self',
      handle: 'roy',
      displayName: 'Roy',
      hasAvatar: false,
    },
    isOwn: true,
    sentAtMs: NOW,
    content: { type: 'Text', body: 'See you there' },
    replyTo: null,
    reactions: [],
    edited: false,
    sendState,
  }
}

function press(key: string, init: KeyboardEventInit = {}): void {
  act(() => {
    dispatchShortcut(new KeyboardEvent('keydown', { key, ...init }))
  })
}

describe('chats sidebar', () => {
  it('shows skeleton rows until the first Reset', async () => {
    renderShell('/chats')
    expect((await screen.findAllByTestId('chat-row-skeleton')).length).toBeGreaterThan(0)
    await resetChatList([general])
    expect(screen.queryByTestId('chat-row-skeleton')).not.toBeInTheDocument()
  })

  it('renders every row field from the store', async () => {
    renderShell('/chats/chat-general')
    await resetChatList([general, old])
    const nav = await screen.findByRole('navigation', { name: enChat.titles.chats })
    const [first, second] = within(nav).getAllByRole('link')

    expect(first).toHaveAttribute('href', '/chats/chat-general')
    expect(first).toHaveAttribute('data-status', 'active')
    expect(first).toHaveTextContent('General')
    expect(first).toHaveTextContent(`${enChat.list.you}See you there`)
    expect(within(first).getByLabelText('3 unread messages')).toHaveTextContent('3')
    expect(within(first).getByLabelText(enChat.list.pinned)).toBeInTheDocument()
    expect(within(first).getByLabelText(enChat.list.muted)).toBeInTheDocument()
    expect(within(first).getByText('G').className).toMatch(/bg-[a-z]+-500/)

    expect(second).not.toHaveAttribute('data-status', 'active')
    expect(second).toHaveTextContent(enChat.list.state.left)
    expect(second).toHaveTextContent(enChat.list.noMessages)
    expect(within(second).queryByLabelText(/unread/)).not.toBeInTheDocument()
  })

  it('shows send ticks only for a loaded own last message', async () => {
    renderShell('/chats')
    await resetChatList([general])
    const row = await screen.findByRole('link', { name: /General/ })
    expect(within(row).queryByLabelText(enChat.pane.status.read)).not.toBeInTheDocument()

    act(() => timelineStore.getState().applyTimelineDiffs(general.chatId, [
      {
        type: 'Reset',
        values: [
          {
            type: 'Message',
            item: ownMessage({ type: 'Read' }),
          },
        ],
      },
    ]))
    expect(within(row).getByLabelText(enChat.pane.status.read)).toHaveClass('text-primary')

    act(() => timelineStore.getState().applyTimelineDiffs(general.chatId, [
      {
        type: 'Set',
        index: 0,
        value: {
          type: 'Message',
          item: ownMessage({ type: 'Failed', reason: 'x', cause: 'Other' }),
        },
      },
    ]))
    expect(within(row).getByLabelText(enChat.pane.status.failed)).toBeInTheDocument()
  })

  it('shows the empty state with a Start a chat action', async () => {
    renderShell('/chats')
    await resetChatList([])
    const aside = screen.getByRole('complementary')
    expect(await within(aside).findByText(enChat.empty.noChats)).toBeInTheDocument()
    fireEvent.click(within(aside).getByRole('button', { name: enChat.list.startChat }))
    expect(await screen.findByRole('dialog', { name: enChat.newChat.title })).toBeInTheDocument()
  })

  it('offers Start a chat on the empty pane when there are no chats', async () => {
    renderShell('/chats')
    await resetChatList([])
    const main = await screen.findByRole('main')
    expect(within(main).getByText(enChat.empty.selectChat)).toBeInTheDocument()
    fireEvent.click(within(main).getByRole('button', { name: enChat.list.startChat }))
    expect(await screen.findByRole('dialog', { name: enChat.newChat.title })).toBeInTheDocument()
  })

  it('links the account avatar to the profile settings', async () => {
    renderShell('/chats')
    const link = await screen.findByRole('link', { name: enChat.list.settings })
    expect(link).toHaveAttribute('href', '/settings/profile')
    expect(await within(link).findByText('RB')).toBeInTheDocument()
  })
})

describe('chat list shortcuts', () => {
  it('opens New chat with Mod+N', async () => {
    renderShell('/chats')
    await resetChatList([general])
    press('n', { ctrlKey: true })
    expect(await screen.findByRole('dialog', { name: enChat.newChat.title })).toBeInTheDocument()
  })

  it('moves through the chats in list order with Ctrl+Up and Ctrl+Down', async () => {
    const router = renderShell('/chats')
    await resetChatList([general, old])
    await screen.findByRole('link', { name: /General/ })

    press('ArrowDown', { ctrlKey: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-general'))
    press('ArrowDown', { ctrlKey: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-old'))
    press('ArrowDown', { ctrlKey: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-old'))
    press('ArrowUp', { ctrlKey: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-general'))
    press('ArrowUp', { ctrlKey: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-general'))
  })

  it('goes to the first chat with Ctrl+Up from the chat index', async () => {
    const router = renderShell('/chats')
    await resetChatList([general, old])
    await screen.findByRole('link', { name: /General/ })
    press('ArrowUp', { ctrlKey: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-general'))
  })
})
