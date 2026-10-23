import type { LinkApproval } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Providers } from '@/app/providers'
import en from '@/i18n/locales/en/account.json'
import { LinkDeviceCard } from './link-device-dialog'
import { decodeQrFromFile } from './scan-image'

vi.mock('./scan-image', () => ({
  decodeQrFromFile: vi.fn(),
}))

const mockedInvoke = vi.mocked(invoke)
const mockedDecode = vi.mocked(decodeQrFromFile)
const t = en.devices.link

const approval: LinkApproval = { approvalId: 'appr-1', deviceId: 'dddddddd4444', sas: '123456' }

function openDialog() {
  render(
    <Providers>
      <LinkDeviceCard />
    </Providers>,
  )
  fireEvent.click(screen.getByRole('button', { name: t.title }))
  return screen.getByRole('dialog')
}

function pickImage(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole('button', { name: t.scanImage }))
  const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!
  expect(input.accept).toBe('image/*')
  fireEvent.change(input, {
    target: {
      files: [
        new File(['png'], 'qr.png', { type: 'image/png' }),
      ],
    },
  })
}

beforeEach(() => {
  mockedInvoke.mockReset()
  mockedDecode.mockReset()
  mockedInvoke.mockImplementation(async command => command === 'approve_link'
    ? approval
    : null)
})

describe('link device dialog: scan from image', () => {
  it('feeds the decoded code to approveLink', async () => {
    mockedDecode.mockResolvedValue('gim-link:abc')
    const dialog = openDialog()
    pickImage(dialog)
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('approve_link', { qrString: 'gim-link:abc' }))
    expect(await within(dialog).findByText(approval.sas)).toBeInTheDocument()
  })

  it('shows the failure copy when no QR code decodes', async () => {
    mockedDecode.mockResolvedValue(null)
    const dialog = openDialog()
    pickImage(dialog)
    expect(await within(dialog).findByText(t.noQrFound)).toBeInTheDocument()
    expect(mockedInvoke).not.toHaveBeenCalledWith('approve_link', expect.anything())
  })
})
