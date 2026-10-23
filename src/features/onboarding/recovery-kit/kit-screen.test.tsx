import type { GimError } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { Providers } from '@/app/providers'
import en from '@/i18n/locales/en/onboarding.json'
import { KitScreen } from './kit-screen'

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn(() => Promise.resolve()),
}))

const KIT_TEXT = 'gim recovery kit\nAccount ID: user-1\nRecovery key: ABCD-1234-EFGH-5678\n\nKeep this secret.'

function mockBridge(saved: () => Promise<string | null> = async () => '/home/roy/gim-recovery-kit.txt') {
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    switch (command) {
      case 'format_recovery_kit':
        return KIT_TEXT
      case 'save_text_file':
        return saved()
      case 'matches_recovery_key_ending':
        return (args as { typed: string }).typed.replace(/[\s-]/g, '').toUpperCase() === '5678'
      default:
        return null
    }
  })
}

function renderKit(onDone = vi.fn(), extraNote?: string) {
  render(
    <Providers>
      <KitScreen userId="user-1" recoveryCode="ABCD1234EFGH5678" onDone={onDone} extraNote={extraNote} />
    </Providers>,
  )
  return onDone
}

beforeEach(() => {
  vi.mocked(invoke).mockReset()
})

describe('kit screen', () => {
  it('shows the account id and the grouped key', async () => {
    mockBridge()
    renderKit(vi.fn(), 'Your old key no longer works.')
    expect(screen.getByRole('heading', { level: 1, name: en.kit.title })).toBeInTheDocument()
    expect(screen.getByText('user-1')).toBeInTheDocument()
    expect(screen.getByText('ABCD-1234-EFGH-5678')).toBeInTheDocument()
    expect(screen.getByText('Your old key no longer works.')).toBeInTheDocument()
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('format_recovery_kit', {
      userId: 'user-1',
      recoveryCode: 'ABCD1234EFGH5678',
      labels: {
        title: en.kit.file.title,
        accountId: en.kit.file.accountId,
        recoveryKey: en.kit.file.recoveryKey,
        note: en.kit.file.note,
      },
    })
  })

  it('copies the formatted kit text', async () => {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
    mockBridge()
    renderKit()
    const copy = await screen.findByRole('button', { name: 'Copy' })
    await vi.waitFor(() => expect(copy).toBeEnabled())
    fireEvent.click(copy)
    expect(await screen.findByText(en.kit.copied)).toBeInTheDocument()
    expect(vi.mocked(writeText)).toHaveBeenCalledWith(KIT_TEXT)
  })

  it('saves the kit as a text file', async () => {
    mockBridge()
    renderKit()
    const save = screen.getByRole('button', { name: en.kit.save })
    await vi.waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)
    expect(await screen.findByText(en.kit.saved)).toBeInTheDocument()
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('save_text_file', {
      defaultName: 'gim-recovery-kit.txt',
      contents: KIT_TEXT,
    })
  })

  it('explains a failed save', async () => {
    const storage: GimError = { kind: 'Storage', message: 'disk full', reason: 'disk full' }
    mockBridge(() => Promise.reject(storage))
    renderKit()
    const save = screen.getByRole('button', { name: en.kit.save })
    await vi.waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)
    expect(await screen.findByText(en.kit.saveFailed)).toBeInTheDocument()
  })

  it('accepts a matching ending and rejects otherwise', async () => {
    mockBridge()
    const onDone = renderKit()
    fireEvent.click(screen.getByRole('button', { name: en.kit.done }))
    expect(screen.getByRole('heading', { level: 1, name: en.kit.checkTitle })).toBeInTheDocument()

    const input = screen.getByLabelText(en.kit.checkLabel)
    fireEvent.change(input, {
      target: { value: '1111' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.kit.checkConfirm }))
    expect(await screen.findByText(en.kit.checkMismatch)).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: en.kit.showAgain }))
    expect(await screen.findByText('ABCD-1234-EFGH-5678')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: en.kit.done }))

    fireEvent.change(screen.getByLabelText(en.kit.checkLabel), {
      target: { value: '56-78' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.kit.checkConfirm }))
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('matches_recovery_key_ending', {
      recoveryCode: 'ABCD1234EFGH5678',
      typed: '56-78',
    })
  })
})
