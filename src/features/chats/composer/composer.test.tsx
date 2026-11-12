import type { MessageItem } from '@/lib/api'
import { open } from '@tauri-apps/plugin-dialog'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import enChat from '@/i18n/locales/en/chat.json'
import { dispatchShortcut } from '@/lib/shortcuts'
import { callsOf, chat, renderWithChats, SESSION } from '../timeline/test-render'
import { Composer } from './composer'
import { composerStore } from './store'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
  convertFileSrc: (path: string) => `asset://${path}`,
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}))

const CHAT_ID = 'c1'

function renderComposer(state: 'Active' | 'Leaving' | 'Left' = 'Active', commands = {}) {
  return renderWithChats(<Composer chatId={CHAT_ID} />, [
    chat(CHAT_ID, { state }),
  ], commands)
}

function input(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: enChat.composer.placeholder })
}

function type(value: string): void {
  fireEvent.change(input(), {
    target: { value },
  })
}

function own(messageId: string, body: string): MessageItem {
  return {
    messageId,
    chatId: CHAT_ID,
    sender: {
      userId: SESSION.userId,
      displayName: SESSION.displayName,
      hasAvatar: false,
    },
    isOwn: true,
    sentAtMs: 0,
    content: { type: 'Text', body },
    replyTo: null,
    reactions: [],
    edited: false,
    sendState: { type: 'Sent' },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('composer', () => {
  it('sends the trimmed text on Enter and clears the input', async () => {
    renderComposer()
    type('  hello  ')
    fireEvent.keyDown(input(), { key: 'Enter' })
    await waitFor(() => expect(callsOf('send_text')).toEqual([
      { chatId: CHAT_ID, body: 'hello', replyTo: null },
    ]))
    expect(input()).toHaveValue('')
    expect(callsOf('stop_typing')).toContainEqual({ chatId: CHAT_ID })
  })

  it('sends with the Send button and ignores an empty input', async () => {
    renderComposer()
    fireEvent.click(screen.getByRole('button', { name: enChat.composer.send }))
    type('   ')
    fireEvent.keyDown(input(), { key: 'Enter' })
    type('hi')
    fireEvent.click(screen.getByRole('button', { name: enChat.composer.send }))
    await waitFor(() => expect(callsOf('send_text')).toHaveLength(1))
  })

  it('does not send on Shift+Enter or while composing', () => {
    renderComposer()
    type('line one')
    const shift = fireEvent.keyDown(input(), { key: 'Enter', shiftKey: true })
    const composing = fireEvent.keyDown(input(), { key: 'Enter', isComposing: true })
    // Not prevented, so the textarea inserts the newline itself.
    expect(shift).toBe(true)
    expect(composing).toBe(true)
    expect(callsOf('send_text')).toEqual([])
  })

  it('throttles setTyping to once per 3 s and stops typing when the input is cleared', () => {
    vi.useFakeTimers({
      toFake: ['Date'],
    })
    renderComposer()
    type('h')
    type('he')
    type('hel')
    expect(callsOf('set_typing')).toEqual([
      { chatId: CHAT_ID, active: true },
    ])
    vi.advanceTimersByTime(3000)
    type('hell')
    expect(callsOf('set_typing')).toHaveLength(2)
    type('')
    expect(callsOf('stop_typing')).toEqual([
      { chatId: CHAT_ID },
    ])
  })

  it('sends a reply to the message set from the actions and Esc cancels it', async () => {
    renderComposer()
    act(() => composerStore.getState().setReplyTo(own('m1', 'quoted body')))
    expect(await screen.findByText('quoted body')).toBeInTheDocument()

    act(() => {
      dispatchShortcut(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(screen.queryByText('quoted body')).not.toBeInTheDocument()

    act(() => composerStore.getState().setReplyTo(own('m1', 'quoted body')))
    type('answer')
    fireEvent.keyDown(input(), { key: 'Enter' })
    await waitFor(() => expect(callsOf('send_text')).toEqual([
      { chatId: CHAT_ID, body: 'answer', replyTo: 'm1' },
    ]))
    expect(screen.queryByText('quoted body')).not.toBeInTheDocument()
  })

  it('edits an own message with the loaded body', async () => {
    renderComposer()
    act(() => composerStore.getState().startEdit(own('m2', 'old text')))
    expect(input()).toHaveValue('old text')
    expect(screen.getByText(enChat.composer.editing)).toBeInTheDocument()
    type('new text')
    fireEvent.keyDown(input(), { key: 'Enter' })
    await waitFor(() => expect(callsOf('edit_message')).toEqual([
      { chatId: CHAT_ID, messageId: 'm2', newBody: 'new text' },
    ]))
    expect(callsOf('send_text')).toEqual([])
    expect(input()).toHaveValue('')
  })

  it.each([
    ['Leaving', enChat.composer.disabled.leaving],
    ['Left', enChat.composer.disabled.left],
  ] as const)('is disabled while the chat is %s', (state, text) => {
    renderComposer(state)
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: enChat.composer.send })).not.toBeInTheDocument()
  })

  it('shows the disabled text when a send fails with ChatNotActive', async () => {
    renderComposer('Active', {
      send_text: () => {
        // eslint-disable-next-line no-throw-literal -- the bridge rejects with a plain GimError object
        throw {
          kind: 'ChatNotActive',
          message: 'not active',
          chatId: CHAT_ID,
          state: 'Left',
        }
      },
    })
    type('hello')
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(await screen.findByText(enChat.composer.disabled.left)).toBeInTheDocument()
  })
})

describe('composer attachments', () => {
  it('sends the text first, then each attachment in order', async () => {
    vi.mocked(open).mockResolvedValueOnce(['C:\\docs\\report.pdf', 'C:\\pics\\cat.png'])
    renderComposer()
    fireEvent.click(screen.getByRole('button', { name: enChat.composer.attach }))
    expect(await screen.findByText('report.pdf')).toBeInTheDocument()
    expect(screen.getByText('cat.png')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: enChat.composer.caption }), {
      target: { value: 'a cat' },
    })
    type('see these')
    fireEvent.keyDown(input(), { key: 'Enter' })

    await waitFor(() => expect(callsOf('send_media')).toHaveLength(2))
    expect(callsOf('send_text')).toEqual([
      { chatId: CHAT_ID, body: 'see these', replyTo: null },
    ])
    expect(callsOf('send_media')).toEqual([
      {
        chatId: CHAT_ID,
        filePath: 'C:\\docs\\report.pdf',
        mime: 'application/pdf',
        caption: null,
        replyTo: null,
      },
      {
        chatId: CHAT_ID,
        filePath: 'C:\\pics\\cat.png',
        mime: 'image/png',
        caption: 'a cat',
        replyTo: null,
      },
    ])
    const order = vi.mocked((await import('@tauri-apps/api/core')).invoke).mock.calls.map(([name]) => name).filter(name => name === 'send_text' || name === 'send_media')
    expect(order).toEqual(['send_text', 'send_media', 'send_media'])
    expect(screen.queryByText('report.pdf')).not.toBeInTheDocument()
  })

  it('uses the text as the caption of a single image', async () => {
    vi.mocked(open).mockResolvedValueOnce(['/home/me/cat.jpg'])
    renderComposer()
    act(() => composerStore.getState().setReplyTo(own('m1', 'quoted')))
    fireEvent.click(screen.getByRole('button', { name: enChat.composer.attach }))
    expect(await screen.findByText('cat.jpg')).toBeInTheDocument()
    type('my cat')
    fireEvent.click(screen.getByRole('button', { name: enChat.composer.send }))
    await waitFor(() => expect(callsOf('send_media')).toEqual([
      {
        chatId: CHAT_ID,
        filePath: '/home/me/cat.jpg',
        mime: 'image/jpeg',
        caption: 'my cat',
        replyTo: 'm1',
      },
    ]))
    expect(callsOf('send_text')).toEqual([])
  })

  it('removes an attachment from the strip', async () => {
    vi.mocked(open).mockResolvedValueOnce(['/tmp/a.txt'])
    renderComposer()
    fireEvent.click(screen.getByRole('button', { name: enChat.composer.attach }))
    expect(await screen.findByText('a.txt')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: enChat.composer.remove }))
    expect(screen.queryByText('a.txt')).not.toBeInTheDocument()
  })

  it('stages a pasted image and shows its thumbnail', async () => {
    renderComposer('Active', {
      stage_attachment: () => '/cache/staging/x.png',
    })
    const file = new File([
      new Uint8Array([1, 2]),
    ], 'image.png', { type: 'image/png' })
    fireEvent.paste(input(), {
      clipboardData: {
        files: [file],
        types: ['Files'],
      },
    })
    await waitFor(() => expect(callsOf('stage_attachment')).toEqual([
      {
        bytes: [1, 2],
        extension: 'png',
      },
    ]))
    const thumb = await screen.findByRole('img', { name: 'image.png' })
    expect(thumb).toHaveAttribute('src', 'asset:///cache/staging/x.png')
  })
})
