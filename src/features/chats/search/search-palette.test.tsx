import type { SearchResults } from '@/lib/api'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import enChat from '@/i18n/locales/en/chat.json'
import { dispatchShortcut } from '@/lib/shortcuts'
import { chat, renderShell, resetChatList } from '../test-utils'
import { callsOf } from '../timeline/test-render'
import { useSearchPalette } from './use-search-palette'

const NOW = Date.now()

const results: SearchResults = {
  chats: [
    { chatId: 'chat-ann', name: 'Ann' },
  ],
  messages: [
    {
      chatId: 'chat-team',
      messageId: 'm7',
      senderName: 'Bob',
      snippet: 'ask Ann about it',
      sentAtMs: NOW,
    },
  ],
}

function press(key: string, init: KeyboardEventInit = {}): void {
  act(() => {
    dispatchShortcut(new KeyboardEvent('keydown', { key, ...init }))
  })
}

async function openPalette(found: SearchResults = results) {
  const locations: string[] = []
  const router = renderShell('/chats', {
    search: () => found,
  })
  router.history.subscribe(({ location }) => locations.push(location.href))
  await resetChatList([
    chat('chat-ann', { name: 'Ann' }),
    chat('chat-team', { name: 'Team', kind: 'Group' }),
  ])
  press('k', { ctrlKey: true })
  const dialog = await screen.findByRole('dialog', { name: enChat.search.title })
  const input = within(dialog).getByRole('textbox', { name: enChat.search.placeholder })
  return { router, dialog, input, locations }
}

beforeEach(() => {
  useSearchPalette.setState({ open: false })
})

describe('search palette', () => {
  it('debounces the query and renders chats and messages', async () => {
    const { dialog, input } = await openPalette()
    expect(within(dialog).getByText(enChat.search.onlySeenNote)).toBeInTheDocument()

    fireEvent.change(input, {
      target: { value: 'a' },
    })
    fireEvent.change(input, {
      target: { value: 'an' },
    })
    fireEvent.change(input, {
      target: { value: 'ann' },
    })
    expect(callsOf('search')).toEqual([])

    expect(await within(dialog).findByText('ask Ann about it')).toBeInTheDocument()
    expect(callsOf('search')).toEqual([
      { query: 'ann', limit: 30 },
    ])
    expect(within(dialog).getByText(enChat.search.chats)).toBeInTheDocument()
    expect(within(dialog).getByText(enChat.search.messages)).toBeInTheDocument()
    expect(within(dialog).getByRole('option', { name: /Ann/, selected: true })).toBeInTheDocument()
    expect(within(dialog).getByText('Bob')).toBeInTheDocument()
  })

  it('opens a message with the message param on Enter', async () => {
    const { router, dialog, input, locations } = await openPalette()
    fireEvent.change(input, {
      target: { value: 'ann' },
    })
    await within(dialog).findByText('ask Ann about it')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(within(dialog).getByRole('option', { name: /ask Ann about it/ })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-team'))
    expect(locations).toContain('/chats/chat-team?message=m7')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: enChat.search.title })).not.toBeInTheDocument())
  })

  it('opens a chat on Enter', async () => {
    const { router, dialog, input } = await openPalette()
    fireEvent.change(input, {
      target: { value: 'ann' },
    })
    await within(dialog).findByText('ask Ann about it')
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-ann'))
  })

  it('shows the empty state', async () => {
    const { dialog, input } = await openPalette({ chats: [], messages: [] })
    fireEvent.change(input, {
      target: { value: 'zzz' },
    })
    expect(await within(dialog).findByText(enChat.search.noResults)).toBeInTheDocument()
  })

  it('closes with Escape', async () => {
    await openPalette()
    press('Escape')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: enChat.search.title })).not.toBeInTheDocument())
  })
})
