import type { CommandHandlers } from '../test-utils'
import type { UserProfile } from '@/lib/api'
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
const alice: UserProfile = {
  userId: ALICE_ID,
  handle: 'alice',
  displayName: 'Alice',
  hasAvatar: false,
}

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
  fireEvent.change(within(dialog).getByRole('textbox', { name: enChat.newChat.searchPlaceholder }), {
    target: { value: text },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: enChat.newChat.search }))
}

beforeEach(() => {
  mockedDecode.mockReset()
})

describe('new chat, direct', () => {
  it('resolves a username through findUser and opens the new chat', async () => {
    const { router, dialog } = await openDialog({
      find_user: () => alice,
      create_direct_chat: () => 'chat-new',
    })
    submitDirect(dialog, '@alice ')
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-new'))
    expect(calls('find_user')).toEqual([
      { handle: 'alice' },
    ])
    expect(calls('create_direct_chat')).toEqual([
      { userId: ALICE_ID },
    ])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('uses a pasted Account ID without findUser', async () => {
    const { router, dialog } = await openDialog({
      create_direct_chat: () => 'chat-new',
    })
    submitDirect(dialog, `My Account ID: "${ALICE_ID}"`)
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats/chat-new'))
    expect(calls('find_user')).toEqual([])
    expect(calls('create_direct_chat')).toEqual([
      { userId: ALICE_ID },
    ])
  })

  it('says so when no one has the username', async () => {
    const { dialog } = await openDialog({
      find_user: () => null,
    })
    submitDirect(dialog, 'nobody')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(enChat.newChat.notFound)
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
      find_user: () => alice,
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
      target: { value: 'alice' },
    })
    fireEvent.submit(member)
    expect(await within(dialog).findByText('Alice')).toBeInTheDocument()
    fireEvent.change(member, {
      target: { value: BOB_ID },
    })
    fireEvent.submit(member)
    expect(await within(dialog).findByText(BOB_ID)).toBeInTheDocument()
    fireEvent.change(member, {
      target: { value: 'alice' },
    })
    fireEvent.submit(member)
    await waitFor(() => expect(calls('find_user')).toHaveLength(2))
    expect(within(dialog).getByText('2 members')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove Alice' }))
    expect(within(dialog).queryByText('Alice')).not.toBeInTheDocument()
    fireEvent.change(member, {
      target: { value: 'alice' },
    })
    fireEvent.submit(member)
    await within(dialog).findByText('Alice')

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
