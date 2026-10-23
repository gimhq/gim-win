import type { GimError, StartupInfo } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Providers } from '@/app/providers'
import en from '@/i18n/locales/en/onboarding.json'
import { ServerStep } from './server-step'

const ready: StartupInfo = {
  serverUrl: 'https://hub.example',
  clientReady: true,
  localStateReset: false,
  session: null,
  error: null,
}

beforeEach(() => {
  vi.mocked(invoke).mockReset()
})

function renderStep(onDone = vi.fn()) {
  render(
    <Providers>
      <ServerStep onDone={onDone} />
    </Providers>,
  )
  return onDone
}

describe('server step', () => {
  it('rejects an address without a scheme and host', async () => {
    const onDone = renderStep()
    fireEvent.change(screen.getByLabelText(en.server.label), {
      target: { value: 'hub.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.server.continue }))
    expect(screen.getByText(en.server.invalid)).toBeInTheDocument()
    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith('set_server_url', expect.anything())
    expect(onDone).not.toHaveBeenCalled()
  })

  it('persists a valid address and reports the startup info', async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'set_server_url')
        return ready
      return null
    })
    const onDone = renderStep()
    fireEvent.change(screen.getByLabelText(en.server.label), {
      target: { value: 'https://hub.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.server.continue }))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(ready))
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('set_server_url', { url: 'https://hub.example' })
  })

  it('explains an unreachable server', async () => {
    const network: GimError = { kind: 'Network', message: 'dns', reason: 'dns' }
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'set_server_url')
        throw network
      return null
    })
    const onDone = renderStep()
    fireEvent.change(screen.getByLabelText(en.server.label), {
      target: { value: 'https://hub.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.server.continue }))
    expect(await screen.findByText(en.server.unreachable)).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })
})
