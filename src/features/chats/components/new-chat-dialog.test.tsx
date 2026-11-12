import type { CommandHandlers } from '../test-utils'
import { invoke } from '@tauri-apps/api/core'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import enChat from '@/i18n/locales/en/chat.json'
import { decodeQrFromImage } from '../lib/qr'
import { renderShell, resetChatList } from '../test-utils'

vi.mock('../lib/qr', () => ({
  decodeQrFromImage: vi.fn(),
}))

const mockedInvoke = vi.mocked(invoke)
const mockedDecode = vi.mocked(decodeQrFromImage)

const ALICE_ID = `u${'a'.repeat(54)}q`
const BOB_ID = `u${'b'.repeat(54)}a`

async function openDialog(commands: CommandHandlers) {
  const router = renderShell('/chats', commands)
  await resetChatList([])
  fireEvent.click(await screen.findByRole('button', { name: enChat.list.newChat }))
  const dialog = await screen.findByRole('dialog', { name: enChat.newChat.title })
  return { router, dialog }
}

function calls(command: string): unknown[] {
  return mockedInvoke.mock.calls.filter(([name]) => name === command).map(([, args]) => args)
}

function submitDirect(dialog: HTMLElement, text: string): void {
  fireEvent.change(within(dialog).getByRole('textbox', { name: enChat.newChat.idPlaceholder }), {
    target: { value: text },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: enChat.newChat.startDirect }))
}

beforeEach(() => {
  mockedDecode.mockReset()
})

describe('new chat, direct', () => {
  it('starts a chat from a pasted Account ID and opens it', async () => {
    const { router, dialog } = await openDialog({
      create_direct_chat: () => 'chat-new',
    })
    submitDirect(dialog, `My Account ID: "${ALICE_ID}"`)
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-new'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls('create_direct_chat')).toEqual([
      { userId: ALICE_ID },
    ])
  })

  it('rejects text without an Account ID and never looks up a username', async () => {
    const { dialog } = await openDialog({})
    submitDirect(dialog, '@alice')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(enChat.newChat.invalidId)
    expect(calls('find_user')).toEqual([])
    expect(calls('create_direct_chat')).toEqual([])
  })

  it('shows a bridge error in plain words', async () => {
    const { dialog } = await openDialog({
      create_direct_chat: () => {
        // eslint-disable-next-line no-throw-literal -- the bridge rejects with a plain GimError object
        throw { kind: 'Network', message: 'io', reason: 'io' }
      },
    })
    submitDirect(dialog, ALICE_ID)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(enChat.errors.offline)
  })

  it('starts a chat from a pasted QR code image', async () => {
    mockedDecode.mockResolvedValue(ALICE_ID)
    const { router, dialog } = await openDialog({
      create_direct_chat: () => 'chat-qr',
    })
    const image = new File(['png'], 'qr.png', { type: 'image/png' })
    fireEvent.paste(within(dialog).getByRole('textbox'), {
      clipboardData: {
        files: [image],
      },
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-qr'))
    expect(mockedDecode).toHaveBeenCalledWith(image)
    expect(calls('create_direct_chat')).toEqual([
      { userId: ALICE_ID },
    ])
  })

  it('reads a picked image and reports a missing code or Account ID', async () => {
    const { dialog } = await openDialog({})
    const input = within(dialog).getByTestId('qr-file-input')
    const image = new File(['png'], 'qr.png', { type: 'image/png' })

    mockedDecode.mockResolvedValueOnce(null)
    fireEvent.change(input, {
      target: {
        files: [image],
      },
    })
    expect(await within(dialog).findByText(enChat.newChat.qrNotFound)).toBeInTheDocument()

    mockedDecode.mockResolvedValueOnce('https://example.com')
    fireEvent.change(input, {
      target: {
        files: [image],
      },
    })
    expect(await within(dialog).findByText(enChat.newChat.invalidId)).toBeInTheDocument()
    expect(calls('create_direct_chat')).toEqual([])
  })
})

describe('new chat, group', () => {
  it('creates a group with the added members', async () => {
    const { router, dialog } = await openDialog({
      create_group_chat: () => 'chat-group',
    })
    fireEvent.click(within(dialog).getByRole('tab', { name: enChat.newChat.tabs.group }))
    const create = within(dialog).getByRole('button', { name: enChat.newChat.group.create })
    expect(create).toBeDisabled()

    fireEvent.change(within(dialog).getByLabelText(enChat.newChat.group.name), {
      target: { value: 'Book club' },
    })
    const member = within(dialog).getByRole('textbox', { name: enChat.newChat.group.addMember })
    fireEvent.change(member, {
      target: { value: ALICE_ID },
    })
    fireEvent.submit(member)
    expect(await within(dialog).findByText(ALICE_ID)).toBeInTheDocument()
    fireEvent.change(member, {
      target: { value: BOB_ID },
    })
    fireEvent.submit(member)
    expect(await within(dialog).findByText(BOB_ID)).toBeInTheDocument()
    fireEvent.change(member, {
      target: { value: ALICE_ID },
    })
    fireEvent.submit(member)
    await waitFor(() => expect(member).toHaveValue(''))
    expect(within(dialog).getByText('2 members')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: `Remove ${ALICE_ID}` }))
    expect(within(dialog).queryByText(ALICE_ID)).not.toBeInTheDocument()
    fireEvent.change(member, {
      target: { value: 'alice' },
    })
    fireEvent.submit(member)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(enChat.newChat.invalidId)
    fireEvent.change(member, {
      target: { value: ALICE_ID },
    })
    fireEvent.submit(member)
    await within(dialog).findByText(ALICE_ID)

    expect(create).toBeEnabled()
    fireEvent.click(create)
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-group'))
    expect(calls('create_group_chat')).toEqual([
      {
        name: 'Book club',
        memberUserIds: [BOB_ID, ALICE_ID],
      },
    ])
  })
})
