import type { GimError, KeepServerInfo } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Providers } from '@/app/providers'
import enCommon from '@/i18n/locales/en/common.json'
import enSettings from '@/i18n/locales/en/settings.json'
import { KeepServerSection } from './keep-server-section'

const mockedInvoke = vi.mocked(invoke)
const keep = enSettings.advanced.keep

const BUILT_IN: KeepServerInfo = {
  url: 'https://keep.g.im',
  source: 'builtIn',
  defaultUrl: 'https://keep.g.im',
  restartRequired: false,
}

/** Bridge replies by command name; unknown commands resolve with `null`. */
let replies: Record<string, (args: unknown) => unknown>

beforeEach(() => {
  replies = {}
  mockedInvoke.mockReset()
  mockedInvoke.mockImplementation(async (command, args) => {
    const reply = replies[command]
    return reply
      ? reply(args)
      : null
  })
})

async function renderSection(info: KeepServerInfo) {
  replies.keep_server = () => info
  render(
    <Providers>
      <KeepServerSection />
    </Providers>,
  )
  await screen.findByText(keep.title)
}

describe('keep server section', () => {
  it('shows the default keep server and the footer', async () => {
    await renderSection(BUILT_IN)
    expect(screen.getByText('https://keep.g.im')).toBeInTheDocument()
    expect(screen.getByText(keep.state.builtIn)).toBeInTheDocument()
    expect(screen.getByText(keep.footer)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: keep.reset })).not.toBeInTheDocument()
    expect(screen.queryByText(keep.restartNotice)).not.toBeInTheDocument()
  })

  it('shows a custom keep server with Reset to default', async () => {
    await renderSection({ ...BUILT_IN, url: 'https://keep.example', source: 'config' })
    expect(screen.getByText('https://keep.example')).toBeInTheDocument()
    expect(screen.getByText(keep.state.config)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: keep.reset })).toBeInTheDocument()
  })

  it('shows the off state without Turn off', async () => {
    await renderSection({ ...BUILT_IN, url: null, source: 'off' })
    expect(screen.getByText(keep.none)).toBeInTheDocument()
    expect(screen.getByText(keep.state.off)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: keep.turnOff })).not.toBeInTheDocument()
  })

  it('says when the environment sets the keep server', async () => {
    await renderSection({ ...BUILT_IN, url: 'http://keep-dev:8080', source: 'env' })
    expect(screen.getByText('http://keep-dev:8080')).toBeInTheDocument()
    expect(screen.getByText(keep.state.env)).toBeInTheDocument()
    expect(screen.getByText(keep.envNote)).toBeInTheDocument()
  })

  it('rejects an invalid address without calling the bridge', async () => {
    await renderSection(BUILT_IN)
    fireEvent.click(screen.getByRole('button', { name: keep.change }))
    fireEvent.change(screen.getByLabelText(keep.urlLabel), {
      target: { value: 'http://keep.example.org' },
    })
    fireEvent.click(screen.getByRole('button', { name: keep.save }))
    expect(screen.getByRole('alert')).toHaveTextContent(keep.invalid)
    expect(mockedInvoke).not.toHaveBeenCalledWith('set_keep_server_url', expect.anything())
  })

  it('saves a valid address and offers a restart', async () => {
    replies.set_keep_server_url = args => ({
      ...BUILT_IN,
      url: (args as { url: string }).url,
      source: 'config',
      restartRequired: true,
    })
    await renderSection(BUILT_IN)
    fireEvent.click(screen.getByRole('button', { name: keep.change }))
    fireEvent.change(screen.getByLabelText(keep.urlLabel), {
      target: { value: 'https://keep.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: keep.save }))
    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent(keep.restartNotice)
    expect(mockedInvoke).toHaveBeenCalledWith('set_keep_server_url', { url: 'https://keep.example' })
    expect(screen.getByText('https://keep.example')).toBeInTheDocument()
    fireEvent.click(within(notice).getByRole('button', { name: keep.restartNow }))
    await vi.waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('restart_app', undefined))
  })

  it('shows the bridge rejection of an address', async () => {
    const invalid: GimError = { kind: 'InvalidInput', message: 'bad', reason: 'bad' }
    replies.set_keep_server_url = () => {
      throw invalid
    }
    await renderSection(BUILT_IN)
    fireEvent.click(screen.getByRole('button', { name: keep.change }))
    fireEvent.change(screen.getByLabelText(keep.urlLabel), {
      target: { value: 'https://keep.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: keep.save }))
    expect(await screen.findByRole('alert')).toHaveTextContent(keep.invalid)
  })

  it('resets to the default', async () => {
    replies.reset_keep_server = () => ({ ...BUILT_IN, restartRequired: true })
    await renderSection({ ...BUILT_IN, url: 'https://keep.example', source: 'config' })
    fireEvent.click(screen.getByRole('button', { name: keep.reset }))
    expect(await screen.findByText(keep.restartNotice)).toBeInTheDocument()
    expect(mockedInvoke).toHaveBeenCalledWith('reset_keep_server', undefined)
    expect(screen.getByText(keep.state.builtIn)).toBeInTheDocument()
  })

  it('turns off after the confirmation', async () => {
    replies.disable_keep_server = () => ({
      ...BUILT_IN,
      url: null,
      source: 'off',
      restartRequired: true,
    })
    await renderSection(BUILT_IN)
    fireEvent.click(screen.getByRole('button', { name: keep.turnOff }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(keep.turnOffTitle)
    expect(dialog).toHaveTextContent(keep.turnOffBody)
    expect(mockedInvoke).not.toHaveBeenCalledWith('disable_keep_server', undefined)
    fireEvent.click(within(dialog).getByRole('button', { name: keep.turnOff }))
    expect(await screen.findByText(keep.restartNotice)).toBeInTheDocument()
    expect(mockedInvoke).toHaveBeenCalledWith('disable_keep_server', undefined)
    expect(screen.getByText(keep.state.off)).toBeInTheDocument()
  })

  it('cancels the change', async () => {
    await renderSection(BUILT_IN)
    fireEvent.click(screen.getByRole('button', { name: keep.change }))
    fireEvent.click(screen.getByRole('button', { name: enCommon.actions.cancel }))
    expect(screen.queryByLabelText(keep.urlLabel)).not.toBeInTheDocument()
  })
})
