import type { LinkStart, StartupInfo } from '@/lib/api'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Providers } from '@/app/providers'
import { routeTree } from '@/app/routeTree.gen'
import en from '@/i18n/locales/en/onboarding.json'

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn(() => Promise.resolve()),
}))

const configured: StartupInfo = {
  serverUrl: 'https://hub.example',
  clientReady: true,
  localStateReset: false,
  session: null,
  error: null,
}

const started: LinkStart = { linkId: 'link-1', qrString: 'gim:link:abc' }

/** A wait_link that resolves only once the test releases it. */
function heldWait(sas: string) {
  let release!: () => void
  const promise = new Promise<string>((resolve) => {
    release = () => resolve(sas)
  })
  return {
    release,
    waitLink: () => promise,
  }
}

const linked: StartupInfo = {
  ...configured,
  session: {
    userId: 'user-1',
    deviceId: 'device-2',
    displayName: 'Roy',
  },
}

function mockBridge(info: StartupInfo, waitLink: () => Promise<string> = async () => '123 456') {
  let current = info
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    switch (command) {
      case 'startup':
        return current
      case 'set_server_url':
        return configured
      case 'start_link':
        return started
      case 'wait_link':
        return waitLink()
      case 'confirm_link':
        // The bridge has a session once the link is accepted.
        if ((args as { accepted: boolean }).accepted)
          current = linked
        return null
      default:
        return null
    }
  })
}

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [path],
    }),
  })
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
  return router
}

beforeEach(() => {
  vi.mocked(invoke).mockReset()
})

describe('link page', () => {
  it('shows the code, the SAS and confirms the link', async () => {
    const held = heldWait('123 456')
    mockBridge(configured, held.waitLink)
    const router = renderAt('/onboarding/link')
    expect(await screen.findByDisplayValue(started.qrString)).toBeInTheDocument()
    expect(screen.getByLabelText(en.link.qrLabel)).toBeInTheDocument()
    expect(screen.getByText(en.link.waiting)).toBeInTheDocument()
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('start_link', {
      hubs: ['https://hub.example'],
    })

    held.release()
    expect(await screen.findByText('123 456')).toBeInTheDocument()
    expect(screen.getByText(en.link.sasExplanation)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: en.link.confirm }))
    expect(await screen.findByText(en.link.linked)).toBeInTheDocument()
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('confirm_link', { accepted: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats'))
  })

  it('copies the code', async () => {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
    mockBridge(configured, () => new Promise(() => {}))
    renderAt('/onboarding/link')
    await screen.findByDisplayValue(started.qrString)
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByText(en.link.copied)).toBeInTheDocument()
    expect(vi.mocked(writeText)).toHaveBeenCalledWith(started.qrString)
  })

  it('rejects when the codes differ', async () => {
    mockBridge(configured)
    renderAt('/onboarding/link')
    fireEvent.click(await screen.findByRole('button', { name: en.link.reject }))
    expect(await screen.findByText(en.link.rejected)).toBeInTheDocument()
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('confirm_link', { accepted: false })
    expect(screen.getByRole('button', { name: en.link.newCode })).toBeInTheDocument()
  })

  it('offers a new code after a timeout', async () => {
    let calls = 0
    mockBridge(configured, async () => {
      calls++
      if (calls === 1)
        throw Object.assign(new Error('wait_link timed out'), { kind: 'Internal', reason: 'timeout' })
      return '654 321'
    })
    renderAt('/onboarding/link')
    expect(await screen.findByText(en.link.timedOut)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: en.link.newCode }))
    expect(await screen.findByText('654 321')).toBeInTheDocument()
    expect(vi.mocked(invoke).mock.calls.filter(([command]) => command === 'start_link')).toHaveLength(2)
  })

  it('asks for the server first when the client could not be created', async () => {
    mockBridge({ ...configured, clientReady: false }, () => new Promise(() => {}))
    renderAt('/onboarding/link')
    fireEvent.change(await screen.findByLabelText(en.server.label), {
      target: { value: 'https://hub.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.server.continue }))
    expect(await screen.findByDisplayValue(started.qrString)).toBeInTheDocument()
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('set_server_url', { url: 'https://hub.example' })
  })

  it('cancel while waiting returns to the welcome page', async () => {
    mockBridge(configured, () => new Promise(() => {}))
    const router = renderAt('/onboarding/link')
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(await screen.findByRole('heading', { level: 1, name: en.titles.welcome })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/onboarding')
  })
})
