import type { MessageItem, SendFailure } from '@/lib/api'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import enChat from '@/i18n/locales/en/chat.json'
import { composerStore } from '../composer/store'
import { MessageActions } from './message-actions'
import { callsOf, chat, renderWithChats, SESSION } from './test-render'

const CHAT_ID = 'c1'

function message(overrides: Partial<MessageItem> = {}): MessageItem {
  return {
    messageId: 'm1',
    chatId: CHAT_ID,
    sender: {
      userId: 'u-ann',
      displayName: 'Ann',
      hasAvatar: false,
    },
    isOwn: false,
    sentAtMs: 0,
    content: { type: 'Text', body: 'hello there' },
    replyTo: null,
    reactions: [],
    edited: false,
    sendState: null,
    ...overrides,
  }
}

function ownMessage(overrides: Partial<MessageItem> = {}): MessageItem {
  return message({
    sender: {
      userId: SESSION.userId,
      displayName: SESSION.displayName,
      hasAvatar: false,
    },
    isOwn: true,
    sendState: { type: 'Sent' },
    ...overrides,
  })
}

function failed(cause: SendFailure): MessageItem {
  return ownMessage({
    sendState: { type: 'Failed', reason: 'x', cause },
  })
}

function renderActions(item: MessageItem, state: 'Active' | 'Left' = 'Active') {
  return renderWithChats(
    <MessageActions message={item}><p>bubble</p></MessageActions>,
    [
      chat(CHAT_ID, { state }),
    ],
  )
}

async function openMenu(): Promise<HTMLElement> {
  fireEvent.contextMenu(screen.getByText('bubble'))
  return screen.findByRole('menu')
}

function itemNames(menu: HTMLElement): string[] {
  return within(menu).getAllByRole('menuitem').map(item => item.textContent ?? '').filter(Boolean)
}

describe('message actions', () => {
  it('offers Reply and Copy but not Edit or Delete on messages of others', async () => {
    renderActions(message())
    const names = itemNames(await openMenu())
    expect(names).toEqual(expect.arrayContaining([enChat.actions.reply, enChat.actions.copy]))
    expect(names).not.toContain(enChat.actions.edit)
    expect(names).not.toContain(enChat.actions.delete)
  })

  it('offers Edit and Delete on own text messages', async () => {
    renderActions(ownMessage())
    const names = itemNames(await openMenu())
    expect(names).toEqual(expect.arrayContaining([enChat.actions.edit, enChat.actions.delete]))
    expect(names).not.toContain(enChat.actions.retry)
  })

  it.each(['Rejected', 'Other'] as const)('offers Retry and Cancel for a %s failure', async (cause) => {
    renderActions(failed(cause))
    const names = itemNames(await openMenu())
    expect(names).toEqual(expect.arrayContaining([enChat.actions.retry, enChat.actions.cancelSend]))
  })

  it.each(['UserSuspended', 'UserNotAdmitted', 'NotAdmittedByPeer'] as const)('hides Retry for a %s failure', async (cause) => {
    renderActions(failed(cause))
    const names = itemNames(await openMenu())
    expect(names).not.toContain(enChat.actions.retry)
    expect(names).toContain(enChat.actions.cancelSend)
  })

  it('retries a failed message', async () => {
    renderActions(failed('Other'))
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: enChat.actions.retry }))
    await waitFor(() => expect(callsOf('retry_send')).toEqual([
      { chatId: CHAT_ID, messageId: 'm1' },
    ]))
  })

  it('sets the reply target of the composer', async () => {
    renderActions(message())
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: enChat.actions.reply }))
    expect(composerStore.getState().replyTo?.messageId).toBe('m1')
  })

  it('starts editing an own message', async () => {
    renderActions(ownMessage())
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: enChat.actions.edit }))
    expect(composerStore.getState().editing?.messageId).toBe('m1')
    expect(composerStore.getState().text).toBe('hello there')
  })

  it('deletes after the confirmation', async () => {
    renderActions(ownMessage())
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: enChat.actions.delete }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(enChat.actions.deleteConfirm.title)).toBeInTheDocument()
    expect(callsOf('delete_message')).toEqual([])
    fireEvent.click(within(dialog).getByRole('button', { name: enChat.actions.deleteConfirm.confirm }))
    await waitFor(() => expect(callsOf('delete_message')).toEqual([
      { chatId: CHAT_ID, messageId: 'm1' },
    ]))
  })

  it('toggles a quick reaction by the own flag', async () => {
    renderActions(message({
      reactions: [
        { emoji: '👍', count: 1, own: true },
      ],
    }))
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: '👍' }))
    await waitFor(() => expect(callsOf('unreact')).toEqual([
      { chatId: CHAT_ID, messageId: 'm1', emoji: '👍' },
    ]))
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: '❤️' }))
    await waitFor(() => expect(callsOf('react')).toEqual([
      { chatId: CHAT_ID, messageId: 'm1', emoji: '❤️' },
    ]))
  })

  it('copies the text and shows Copied', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    renderActions(message())
    await act(async () => {
      fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: enChat.actions.copy }))
    })
    expect(writeText).toHaveBeenCalledWith('hello there')
    expect(await screen.findByText(enChat.actions.copied)).toBeInTheDocument()
  })

  it('disables everything but Copy when the chat is not active', async () => {
    renderActions(ownMessage(), 'Left')
    const menu = await openMenu()
    expect(within(menu).getByRole('menuitem', { name: enChat.actions.reply })).toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByRole('menuitem', { name: enChat.actions.delete })).toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByRole('menuitem', { name: enChat.actions.copy })).not.toHaveAttribute('aria-disabled', 'true')
  })
})
