import type { DeviceInfo, GimError, Session } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Providers } from '@/app/providers'
import en from '@/i18n/locales/en/account.json'
import enCommon from '@/i18n/locales/en/common.json'
import enOnboarding from '@/i18n/locales/en/onboarding.json'
import enSettings from '@/i18n/locales/en/settings.json'
import { formatDate } from '@/lib/format'
import { DevicesPage } from './devices-page'

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn(() => Promise.resolve()),
}))

const mockedInvoke = vi.mocked(invoke)
const t = en.devices

const session: Session = {
  userId: 'user-1',
  deviceId: 'aaaaaaaa1111',
  displayName: 'Roy Smith',
}

const CREATED = Date.UTC(2026, 9, 1)

const deviceList: DeviceInfo[] = [
  {
    deviceId: 'aaaaaaaa1111',
    createdAtMs: CREATED,
    isCurrent: true,
    revoked: false,
  },
  {
    deviceId: 'bbbbbbbb2222',
    createdAtMs: CREATED,
    isCurrent: false,
    revoked: false,
  },
  {
    deviceId: 'cccccccc3333',
    createdAtMs: 0,
    isCurrent: false,
    revoked: true,
  },
]

function mockBridge(overrides: Record<string, (args: any) => unknown> = {}) {
  mockedInvoke.mockImplementation(async (command, args) => {
    const handler = overrides[command]
    if (handler)
      return handler(args)
    switch (command) {
      case 'session':
        return session
      case 'devices':
        return deviceList
      case 'format_recovery_kit':
        return 'kit'
      default:
        return null
    }
  })
}

function renderPage() {
  render(
    <Providers>
      <DevicesPage />
    </Providers>,
  )
}

beforeEach(() => {
  mockedInvoke.mockReset()
})

describe('devices page', () => {
  it('shows the explainer and the device rows', async () => {
    mockBridge()
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: enSettings.titles.devices })).toBeInTheDocument()
    expect(screen.getByText(t.recoveryKey.title)).toBeInTheDocument()
    expect(screen.getByText(t.recoveryKey.body)).toBeInTheDocument()
    expect(screen.getByText(t.link.body)).toBeInTheDocument()

    const current = (await screen.findByText(t.list.thisDevice)).closest('li')!
    expect(current).toHaveTextContent(`Added ${formatDate(CREATED)}`)
    expect(within(current).queryByRole('button', { name: t.list.remove })).toBeNull()

    const other = screen.getByText('Device bbbbbbbb').closest('li')!
    expect(within(other).getByRole('button', { name: t.list.remove })).toBeInTheDocument()

    const revoked = screen.getByText('Device cccccccc').closest('li')!
    expect(revoked).toHaveTextContent(t.list.removed)
    expect(revoked).not.toHaveTextContent('Added')
    expect(within(revoked).queryByRole('button', { name: t.list.remove })).toBeNull()
  })

  it('shows the empty state', async () => {
    mockBridge({
      devices: () => [],
    })
    renderPage()
    expect(await screen.findByText(t.list.empty)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: t.list.refresh }))
    await waitFor(() => expect(mockedInvoke.mock.calls.filter(([command]) => command === 'devices')).toHaveLength(2))
  })

  it('removes a device after confirming', async () => {
    mockBridge()
    renderPage()
    const other = (await screen.findByText('Device bbbbbbbb')).closest('li')!
    fireEvent.click(within(other).getByRole('button', { name: t.list.remove }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(t.list.removeBody)
    expect(mockedInvoke).not.toHaveBeenCalledWith('revoke_device', expect.anything())
    fireEvent.click(within(dialog).getByRole('button', { name: t.list.removeConfirm }))
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('revoke_device', { deviceId: 'bbbbbbbb2222' }))
    await waitFor(() => expect(mockedInvoke.mock.calls.filter(([command]) => command === 'devices')).toHaveLength(2))
  })

  it('creates a new recovery key and shows the kit with the unsynced note', async () => {
    mockBridge({
      rotate_recovery_code: () => ({
        recoveryCode: 'ABCD1234EFGH5678',
        unsyncedHubIds: ['hub-a', 'hub-b'],
      }),
    })
    renderPage()
    await screen.findByText(t.list.thisDevice)
    fireEvent.click(screen.getByRole('button', { name: t.recoveryKey.create }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(t.recoveryKey.confirmBody)
    expect(mockedInvoke).not.toHaveBeenCalledWith('rotate_recovery_code', undefined)
    fireEvent.click(within(dialog).getByRole('button', { name: t.recoveryKey.confirm }))
    expect(await screen.findByRole('heading', { level: 1, name: enOnboarding.kit.title })).toBeInTheDocument()
    expect(screen.getByText('ABCD-1234-EFGH-5678')).toBeInTheDocument()
    expect(screen.getByText('user-1')).toBeInTheDocument()
    expect(screen.getByText(t.recoveryKey.unsynced_other.replace('{{count}}', '2'))).toBeInTheDocument()
  })

  it('explains a failed rotation', async () => {
    const offline: GimError = { kind: 'Network', message: 'down', reason: 'down' }
    mockBridge({
      rotate_recovery_code: () => {
        throw offline
      },
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: t.recoveryKey.create }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: t.recoveryKey.confirm }))
    expect(await within(dialog).findByText(t.errors.offline)).toBeInTheDocument()
  })
})

describe('recovery key reveal', () => {
  const r = t.reveal
  const CODE = 'ABCD1234EFGH5678'

  async function openReveal() {
    renderPage()
    await screen.findByText(t.list.thisDevice)
    fireEvent.click(screen.getByRole('button', { name: t.recoveryKey.view }))
  }

  it('asks for device authentication, then shows the key under capture protection', async () => {
    mockBridge({
      authenticate_device: () => 'Verified',
      recovery_code: () => CODE,
      format_recovery_kit: () => 'gim recovery kit',
    })
    await openReveal()
    expect(await screen.findByText('ABCD-1234-EFGH-5678')).toBeInTheDocument()
    expect(mockedInvoke).toHaveBeenCalledWith('authenticate_device', { reason: r.reason })
    const calls = mockedInvoke.mock.calls.map(([command]) => command)
    expect(calls.indexOf('authenticate_device')).toBeLessThan(calls.indexOf('recovery_code'))
    expect(mockedInvoke).toHaveBeenCalledWith('set_capture_protection', { enabled: true })
    expect(await screen.findByRole('img', { name: r.qr })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: enCommon.actions.copy }))
    await waitFor(() => expect(vi.mocked(writeText)).toHaveBeenCalledWith('gim recovery kit'))

    fireEvent.click(screen.getByRole('button', { name: r.hide }))
    expect(await screen.findByRole('button', { name: t.recoveryKey.view })).toBeInTheDocument()
    expect(screen.queryByText('ABCD-1234-EFGH-5678')).not.toBeInTheDocument()
    expect(mockedInvoke).toHaveBeenCalledWith('set_capture_protection', { enabled: false })
  })

  it('hides the key when the window loses focus, but not while saving the kit', async () => {
    let finishSave: (path: string | null) => void = () => {}
    mockBridge({
      authenticate_device: () => 'Verified',
      recovery_code: () => CODE,
      format_recovery_kit: () => 'gim recovery kit',
      save_text_file: () => new Promise((resolve) => {
        finishSave = resolve
      }),
    })
    await openReveal()
    await screen.findByRole('img', { name: r.qr })
    fireEvent.click(screen.getByRole('button', { name: enOnboarding.kit.save }))
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('save_text_file', expect.anything()))
    fireEvent.blur(window)
    expect(screen.getByText('ABCD-1234-EFGH-5678')).toBeInTheDocument()
    finishSave('/tmp/kit.txt')
    expect(await screen.findByText(enOnboarding.kit.saved)).toBeInTheDocument()

    fireEvent.blur(window)
    await waitFor(() => expect(screen.queryByText('ABCD-1234-EFGH-5678')).not.toBeInTheDocument())
  })

  it('never reads the key when authentication is canceled, and can retry', async () => {
    let outcome = 'Canceled'
    mockBridge({
      authenticate_device: () => outcome,
      recovery_code: () => CODE,
    })
    await openReveal()
    expect(await screen.findByText(r.canceled)).toBeInTheDocument()
    expect(mockedInvoke).not.toHaveBeenCalledWith('recovery_code', undefined)
    outcome = 'Verified'
    fireEvent.click(screen.getByRole('button', { name: r.retry }))
    expect(await screen.findByText('ABCD-1234-EFGH-5678')).toBeInTheDocument()
  })

  it('says so when the device cannot authenticate', async () => {
    mockBridge({
      authenticate_device: () => 'Unavailable',
    })
    await openReveal()
    expect(await screen.findByText(r.unavailable)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: r.retry })).not.toBeInTheDocument()
    expect(mockedInvoke).not.toHaveBeenCalledWith('recovery_code', undefined)
  })

  it('offers a new key on a device that does not hold one, then runs the kit check', async () => {
    mockBridge({
      authenticate_device: () => 'Verified',
      recovery_code: () => null,
      rotate_recovery_code: () => ({
        recoveryCode: CODE,
        unsyncedHubIds: [],
      }),
    })
    await openReveal()
    expect(await screen.findByText(r.notHeldTitle)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: t.recoveryKey.create }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: t.recoveryKey.confirm }))
    expect(await screen.findByRole('heading', { level: 1, name: enOnboarding.kit.title })).toBeInTheDocument()
    expect(screen.getByText('ABCD-1234-EFGH-5678')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: enOnboarding.kit.done }))
    expect(await screen.findByLabelText(enOnboarding.kit.checkLabel)).toBeInTheDocument()
  })
})

describe('link a new device', () => {
  const approval = { approvalId: 'approval-1', sas: '123 456', deviceId: 'dddddddd4444' }

  async function pasteCode(code = 'gim-link:abc') {
    fireEvent.click(screen.getByRole('button', { name: t.link.title }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(t.link.codeLabel), {
      target: { value: code },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: t.link.continue }))
    return dialog
  }

  it('approves the code and accepts matching codes', async () => {
    mockBridge({
      approve_link: () => approval,
    })
    renderPage()
    const dialog = await pasteCode()
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('approve_link', { qrString: 'gim-link:abc' }))
    expect(await within(dialog).findByText('123 456')).toBeInTheDocument()
    expect(dialog).toHaveTextContent('New device: dddddddd')
    fireEvent.click(within(dialog).getByRole('button', { name: t.link.match }))
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('confirm_approval', { approvalId: 'approval-1', accepted: true }))
    expect(await within(dialog).findByText(t.link.linked)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: t.link.done }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mockedInvoke.mock.calls.filter(([command]) => command === 'confirm_approval')).toHaveLength(1)
  })

  it('rejects codes that do not match', async () => {
    mockBridge({
      approve_link: () => approval,
    })
    renderPage()
    const dialog = await pasteCode()
    fireEvent.click(await within(dialog).findByRole('button', { name: t.link.noMatch }))
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('confirm_approval', { approvalId: 'approval-1', accepted: false }))
    expect(await within(dialog).findByText(t.link.rejected)).toBeInTheDocument()
  })

  it('rejects an approval abandoned by closing the dialog', async () => {
    mockBridge({
      approve_link: () => approval,
    })
    renderPage()
    const dialog = await pasteCode()
    await within(dialog).findByText('123 456')
    fireEvent.click(within(dialog).getByRole('button', { name: t.cancel }))
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('confirm_approval', { approvalId: 'approval-1', accepted: false }))
  })

  it('explains an invalid code', async () => {
    const invalid: GimError = { kind: 'InvalidInput', message: 'bad', reason: 'bad' }
    mockBridge({
      approve_link: () => {
        throw invalid
      },
    })
    renderPage()
    const dialog = await pasteCode('nonsense')
    expect(await within(dialog).findByText(t.link.invalidCode)).toBeInTheDocument()
    expect(mockedInvoke).not.toHaveBeenCalledWith('confirm_approval', expect.anything())
  })
})
