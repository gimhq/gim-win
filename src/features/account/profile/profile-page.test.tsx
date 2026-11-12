import type { GimError, Session } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const roy: Session = {
  userId: 'user-1',
  deviceId: 'device-1',
  handle: '',
  displayName: 'Roy Smith',
}

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
    mockBridge(roy)
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: enSettings.titles.profile })).toBeInTheDocument()
    expect(screen.getByText(enCommon.state.loading)).toBeInTheDocument()
    expect(await screen.findByText('Roy Smith')).toBeInTheDocument()
    expect(screen.getByText('RS')).toBeInTheDocument()
    expect(screen.queryByText(/@/)).not.toBeInTheDocument()
    expect(screen.getByText('user-1')).toBeInTheDocument()
    const qr = screen.getByRole('img', { name: en.profile.qr.title })
    expect(qr.tagName.toLowerCase()).toBe('svg')
  })

  it('encodes the plain user id in the QR code', async () => {
    mockBridge(roy)
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
    mockBridge(roy)
    renderPage()
    await screen.findByText('user-1')
    fireEvent.click(screen.getByRole('button', { name: en.profile.accountId.copy }))
    await waitFor(() => expect(vi.mocked(writeText)).toHaveBeenCalledWith('user-1'))
    expect(await screen.findByText(en.profile.accountId.copied)).toBeInTheDocument()
  })

  it('edits the display name', async () => {
    mockBridge(roy, {
      set_display_name: ({ name }) => ({ ...roy, displayName: name }),
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
    mockBridge(roy)
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

  it('explains a busy server', async () => {
    const busy: GimError = {
      kind: 'RetryLater',
      message: 'busy',
      status: 429,
      retryAfterSecs: 30,
      reason: 'busy',
    }
    mockBridge(roy, {
      set_display_name: () => {
        throw busy
      },
    })
    renderPage()
    await screen.findByText('Roy Smith')
    fireEvent.click(screen.getByRole('button', { name: en.profile.displayName.edit }))
    fireEvent.change(screen.getByLabelText(en.profile.displayName.label), {
      target: { value: 'Roy' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.profile.save }))
    expect(await screen.findByText(en.errors.busy.replace('{{seconds}}', '30'))).toBeInTheDocument()
  })
})

function QrFixture({ value }: { value: string }) {
  return <QRCodeSVG value={value} size={200} />
}
