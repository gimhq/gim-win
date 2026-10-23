import type { GimError, Session } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QRCodeSVG } from 'qrcode.react'
import { Providers } from '@/app/providers'
import en from '@/i18n/locales/en/account.json'
import enCommon from '@/i18n/locales/en/common.json'
import enSettings from '@/i18n/locales/en/settings.json'
import { ProfilePage } from './profile-page'

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn(() => Promise.resolve()),
}))

const mockedInvoke = vi.mocked(invoke)

const noHandle: Session = {
  userId: 'user-1',
  deviceId: 'device-1',
  handle: '',
  displayName: 'Roy Smith',
}

const withHandle: Session = { ...noHandle, handle: 'roy' }

/** Answers `session` with the current value; `overrides` handle other commands. */
function mockBridge(initial: Session, overrides: Record<string, (args: any) => unknown> = {}) {
  let current = initial
  mockedInvoke.mockImplementation(async (command, args) => {
    if (command === 'session')
      return current
    const handler = overrides[command]
    if (handler) {
      const next = await handler(args)
      if (next)
        current = next as Session
      return null
    }
    return null
  })
}

function renderPage() {
  render(
    <Providers>
      <ProfilePage />
    </Providers>,
  )
}

beforeEach(() => {
  mockedInvoke.mockReset()
  vi.mocked(writeText).mockClear()
})

describe('profile page', () => {
  it('shows the identity, Account ID and QR code', async () => {
    mockBridge(noHandle)
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: enSettings.titles.profile })).toBeInTheDocument()
    expect(screen.getByText(enCommon.state.loading)).toBeInTheDocument()
    expect(await screen.findByText('Roy Smith')).toBeInTheDocument()
    expect(screen.getByText('RS')).toBeInTheDocument()
    expect(screen.getByText(en.profile.username.empty)).toBeInTheDocument()
    expect(screen.getByText('user-1')).toBeInTheDocument()
    const qr = screen.getByRole('img', { name: en.profile.qr.title })
    expect(qr.tagName.toLowerCase()).toBe('svg')
  })

  it('encodes the plain user id in the QR code', async () => {
    mockBridge(noHandle)
    renderPage()
    const qr = await screen.findByRole('img', { name: en.profile.qr.title })
    const { container } = render(
      <Providers>
        <QrFixture value="user-1" />
      </Providers>,
    )
    expect(qr.innerHTML).toBe(container.querySelector('svg')!.innerHTML)
  })

  it('copies the Account ID', async () => {
    mockBridge(noHandle)
    renderPage()
    await screen.findByText('user-1')
    fireEvent.click(screen.getByRole('button', { name: en.profile.accountId.copy }))
    await waitFor(() => expect(vi.mocked(writeText)).toHaveBeenCalledWith('user-1'))
    expect(await screen.findByText(en.profile.accountId.copied)).toBeInTheDocument()
  })

  it('edits the display name', async () => {
    mockBridge(noHandle, {
      set_display_name: ({ name }) => ({ ...noHandle, displayName: name }),
    })
    renderPage()
    await screen.findByText('Roy Smith')
    fireEvent.click(screen.getByRole('button', { name: en.profile.displayName.edit }))
    const input = screen.getByLabelText(en.profile.displayName.label)
    fireEvent.change(input, {
      target: { value: 'Ada Lovelace' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.profile.save }))
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('set_display_name', { name: 'Ada Lovelace' }))
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('rejects an empty display name', async () => {
    mockBridge(noHandle)
    renderPage()
    await screen.findByText('Roy Smith')
    fireEvent.click(screen.getByRole('button', { name: en.profile.displayName.edit }))
    fireEvent.change(screen.getByLabelText(en.profile.displayName.label), {
      target: { value: '  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.profile.save }))
    expect(screen.getByText(en.profile.displayName.invalid)).toBeInTheDocument()
    expect(mockedInvoke).not.toHaveBeenCalledWith('set_display_name', expect.anything())
  })

  it('claims a username', async () => {
    mockBridge(noHandle, {
      claim_handle: ({ handle }) => ({ ...noHandle, handle }),
    })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: en.profile.username.add }))
    expect(screen.getByText(en.profile.username.helper)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(en.profile.username.label), {
      target: { value: 'roy_s' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.profile.save }))
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('claim_handle', { handle: 'roy_s' }))
    expect(await screen.findByText('@roy_s')).toBeInTheDocument()
  })

  it('rejects an invalid username without calling the bridge', async () => {
    mockBridge(noHandle)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: en.profile.username.add }))
    fireEvent.change(screen.getByLabelText(en.profile.username.label), {
      target: { value: 'No!' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.profile.save }))
    expect(screen.getByText(en.profile.username.invalid)).toBeInTheDocument()
    expect(mockedInvoke).not.toHaveBeenCalledWith('claim_handle', expect.anything())
  })

  it('explains a taken username', async () => {
    const taken: GimError = {
      kind: 'Server',
      message: 'conflict',
      status: 409,
      reason: 'conflict',
    }
    mockBridge(noHandle, {
      claim_handle: () => {
        throw taken
      },
    })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: en.profile.username.add }))
    fireEvent.change(screen.getByLabelText(en.profile.username.label), {
      target: { value: 'roy' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.profile.save }))
    expect(await screen.findByText(en.profile.username.taken)).toBeInTheDocument()
  })

  it('explains a busy server', async () => {
    const busy: GimError = {
      kind: 'RetryLater',
      message: 'busy',
      status: 429,
      retryAfterSecs: 30,
      reason: 'busy',
    }
    mockBridge(noHandle, {
      claim_handle: () => {
        throw busy
      },
    })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: en.profile.username.add }))
    fireEvent.change(screen.getByLabelText(en.profile.username.label), {
      target: { value: 'roy' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.profile.save }))
    expect(await screen.findByText(en.errors.busy.replace('{{seconds}}', '30'))).toBeInTheDocument()
  })

  it('shows the username with Change and Remove', async () => {
    mockBridge(withHandle)
    renderPage()
    expect(await screen.findByText('@roy')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: en.profile.username.change }))
    expect(screen.getByLabelText(en.profile.username.label)).toHaveValue('roy')
  })

  it('removes the username after confirming', async () => {
    mockBridge(withHandle, {
      release_handle: () => ({ ...withHandle, handle: '' }),
    })
    renderPage()
    await screen.findByText('@roy')
    fireEvent.click(screen.getByRole('button', { name: en.profile.username.remove }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(en.profile.username.removeTitle)
    expect(mockedInvoke).not.toHaveBeenCalledWith('release_handle', undefined)
    fireEvent.click(within(dialog).getByRole('button', { name: en.profile.username.remove }))
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('release_handle', undefined))
    expect(await screen.findByText(en.profile.username.empty)).toBeInTheDocument()
  })
})

function QrFixture({ value }: { value: string }) {
  return <QRCodeSVG value={value} size={200} />
}
