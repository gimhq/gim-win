import type { UserProfile } from '@/lib/api'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import enChat from '@/i18n/locales/en/chat.json'
import { MembersButton } from './members-sheet'
import { callsOf, chat, renderWithChats, SESSION } from './test-render'

const CHAT_ID = 'g1'
const DAVE_ID = `u${'d'.repeat(54)}q`

const ann: UserProfile = {
  userId: 'u-ann',
  displayName: 'Ann',
  hasAvatar: false,
}
const self: UserProfile = {
  userId: SESSION.userId,
  displayName: SESSION.displayName,
  hasAvatar: false,
}

async function openSheet(state: 'Active' | 'Left' = 'Active', commands = {}) {
  renderWithChats(<MembersButton chatId={CHAT_ID} />, [
    chat(CHAT_ID, { kind: 'Group', name: 'Team', state }),
  ], {
    chat_members: () => [ann, self],
    ...commands,
  })
  fireEvent.click(screen.getByRole('button', { name: enChat.members.title }))
  const sheet = await screen.findByRole('dialog', { name: enChat.members.title })
  await within(sheet).findByText('Ann')
  return sheet
}

describe('members sheet', () => {
  it('lists the members and marks the signed-in user', async () => {
    const sheet = await openSheet()
    expect(await within(sheet).findByText(enChat.members.you)).toBeInTheDocument()
    // Remove for Ann only, never for self.
    expect(within(sheet).getAllByRole('button', { name: enChat.members.remove })).toHaveLength(1)
  })

  it('adds a member by a pasted Account ID', async () => {
    const sheet = await openSheet()
    fireEvent.change(within(sheet).getByRole('textbox', { name: enChat.members.addPlaceholder }), {
      target: { value: `id: ${DAVE_ID}` },
    })
    fireEvent.click(within(sheet).getByRole('button', { name: enChat.members.add }))
    await waitFor(() => expect(callsOf('add_members')).toEqual([
      {
        chatId: CHAT_ID,
        userIds: [DAVE_ID],
      },
    ]))
  })

  it('rejects text without an Account ID', async () => {
    const sheet = await openSheet()
    fireEvent.change(within(sheet).getByRole('textbox', { name: enChat.members.addPlaceholder }), {
      target: { value: '@cy' },
    })
    fireEvent.click(within(sheet).getByRole('button', { name: enChat.members.add }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(enChat.newChat.invalidId)
    expect(callsOf('add_members')).toEqual([])
  })

  it('removes a member after the confirmation', async () => {
    const sheet = await openSheet()
    fireEvent.click(within(sheet).getByRole('button', { name: enChat.members.remove }))
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText('Remove Ann from this chat?')).toBeInTheDocument()
    fireEvent.click(within(confirm).getByRole('button', { name: enChat.members.remove }))
    await waitFor(() => expect(callsOf('remove_member')).toEqual([
      { chatId: CHAT_ID, userId: 'u-ann' },
    ]))
  })

  it('leaves the chat after the confirmation', async () => {
    const sheet = await openSheet()
    fireEvent.click(within(sheet).getByRole('button', { name: enChat.members.leave }))
    const confirm = await screen.findByRole('alertdialog')
    fireEvent.click(within(confirm).getByRole('button', { name: enChat.members.leaveConfirm.confirm }))
    await waitFor(() => expect(callsOf('leave_chat')).toEqual([
      { chatId: CHAT_ID },
    ]))
  })

  it('disables every change when the chat is not active', async () => {
    const sheet = await openSheet('Left')
    expect(within(sheet).getByRole('button', { name: enChat.members.add })).toBeDisabled()
    expect(within(sheet).getByRole('button', { name: enChat.members.remove })).toBeDisabled()
    expect(within(sheet).getByRole('button', { name: enChat.members.leave })).toBeDisabled()
  })

  it('shows only the peer and Leave for a direct chat', async () => {
    renderWithChats(<MembersButton chatId="d1" />, [
      chat('d1', { peer: ann, name: 'Ann' }),
    ])
    fireEvent.click(screen.getByRole('button', { name: enChat.members.title }))
    const sheet = await screen.findByRole('dialog', { name: enChat.members.title })
    expect(within(sheet).getByText('Ann')).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: enChat.members.add })).not.toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: enChat.members.remove })).not.toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: enChat.members.leave })).toBeInTheDocument()
    expect(callsOf('chat_members')).toEqual([])
  })
})
