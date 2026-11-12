import type { Session, StartupInfo } from '@/lib/api'
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

const created: Session = {
  userId: 'user-1',
  deviceId: 'device-1',
  displayName: 'Roy',
}

interface Bridge {
  info?: StartupInfo
  createIdentity?: () => Promise<string>
}

function mockBridge({ info = configured, createIdentity = async () => 'ABCD1234EFGH5678' }: Bridge = {}) {
  let current = info
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    switch (command) {
      case 'startup':
        return current
      case 'set_server_url':
        return configured
      case 'create_identity': {
        const code = await createIdentity()
        current = { ...configured, session: created }
        return code
      }
      case 'session':
        return current.session
      case 'format_recovery_kit':
        return 'gim recovery kit\nAccount ID: user-1\nRecovery key: ABCD-1234-EFGH-5678'
      case 'matches_recovery_key_ending':
        return (args as { typed: string }).typed === '5678'
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

async function createAccount(name = 'Roy') {
  fireEvent.change(await screen.findByLabelText(en.create.nameLabel), {
    target: { value: name },
  })
  fireEvent.click(screen.getByRole('button', { name: en.create.submit }))
}

async function passKit() {
  fireEvent.click(await screen.findByRole('button', { name: en.kit.done }))
  fireEvent.change(screen.getByLabelText(en.kit.checkLabel), {
    target: { value: '5678' },
  })
  fireEvent.click(screen.getByRole('button', { name: en.kit.checkConfirm }))
}

beforeEach(() => {
  vi.mocked(invoke).mockReset()
})

describe('create page', () => {
  it('creates the account, checks the kit and lands on /chats', async () => {
    mockBridge()
    const router = renderAt('/onboarding/create')
    expect(await screen.findByRole('heading', { level: 1, name: en.create.nameTitle })).toBeInTheDocument()
    expect(screen.queryByLabelText(en.server.label)).not.toBeInTheDocument()

    await createAccount(' Roy ')
    expect(await screen.findByRole('heading', { level: 1, name: en.kit.title })).toBeInTheDocument()
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('create_identity', { displayName: 'Roy' })
    expect(screen.getByText('user-1')).toBeInTheDocument()
    expect(screen.getByText('ABCD-1234-EFGH-5678')).toBeInTheDocument()

    await passKit()
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats'))
  })

  it('shows an error and retries a failed createIdentity', async () => {
    let calls = 0
    mockBridge({
      createIdentity: async () => {
        calls++
        if (calls === 1)
          throw Object.assign(new Error('offline'), { kind: 'Network', reason: 'offline' })
        return 'ABCD1234EFGH5678'
      },
    })
    renderAt('/onboarding/create')
    await createAccount()
    expect(await screen.findByText(en.errors.network)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: en.create.submit }))
    expect(await screen.findByRole('heading', { level: 1, name: en.kit.title })).toBeInTheDocument()
  })

  it('asks for the server first when the client could not be created', async () => {
    mockBridge({
      info: { ...configured, clientReady: false },
    })
    renderAt('/onboarding/create')
    fireEvent.change(await screen.findByLabelText(en.server.label), {
      target: { value: 'https://hub.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.server.continue }))
    expect(await screen.findByRole('heading', { level: 1, name: en.create.nameTitle })).toBeInTheDocument()
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('set_server_url', { url: 'https://hub.example' })
  })

  it('opens the server step with "Use another server"', async () => {
    mockBridge()
    renderAt('/onboarding/create')
    fireEvent.click(await screen.findByRole('button', { name: en.create.otherServer }))
    expect(await screen.findByLabelText(en.server.label)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { level: 1, name: en.create.nameTitle })).toBeInTheDocument()
  })

  it('goes back to the welcome page from the first step', async () => {
    mockBridge()
    const router = renderAt('/onboarding/create')
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { level: 1, name: en.titles.welcome })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/onboarding')
  })
})
