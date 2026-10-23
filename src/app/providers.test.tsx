import type { StartupInfo } from '@/lib/api'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'
import { render, screen } from '@testing-library/react'
import enChat from '@/i18n/locales/en/chat.json'
import enOnboarding from '@/i18n/locales/en/onboarding.json'
import enSettings from '@/i18n/locales/en/settings.json'
import { Providers } from './providers'
import { routeTree } from './routeTree.gen'

const mockedInvoke = vi.mocked(invoke)

const noSession: StartupInfo = {
  serverUrl: null,
  clientReady: true,
  localStateReset: false,
  session: null,
  error: null,
}

const withSession: StartupInfo = {
  ...noSession,
  serverUrl: 'https://hub.example',
  session: {
    userId: 'user-1',
    deviceId: 'device-1',
    handle: '',
    displayName: 'Roy',
  },
}

function mockBridge(info: StartupInfo) {
  mockedInvoke.mockImplementation(async (command) => {
    if (command === 'startup')
      return info
    return null
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
  mockedInvoke.mockReset()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('routing', () => {
  it('sends a first launch to onboarding', async () => {
    mockBridge(noSession)
    const router = renderAt('/')
    expect(await screen.findByRole('heading', { name: enOnboarding.titles.welcome })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/onboarding')
  })

  it('sends a signed-in user to the chat list', async () => {
    mockBridge(withSession)
    const router = renderAt('/')
    expect(await screen.findByRole('heading', { name: enChat.titles.chats })).toBeInTheDocument()
    expect(screen.getByText(enChat.empty.selectChat)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/chats')
  })

  it('keeps the shell behind a session', async () => {
    mockBridge(noSession)
    const router = renderAt('/settings/profile')
    expect(await screen.findByRole('heading', { name: enOnboarding.titles.welcome })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/onboarding')
  })

  it('shows the profile section with the settings list', async () => {
    mockBridge(withSession)
    renderAt('/settings/profile')
    expect(await screen.findByRole('heading', { level: 1, name: enSettings.titles.profile })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: enSettings.titles.settings })
    for (const title of Object.values(enSettings.titles).filter(title => title !== enSettings.titles.settings))
      expect(nav).toHaveTextContent(title)
  })

  it('redirects /settings to the profile section', async () => {
    mockBridge(withSession)
    const router = renderAt('/settings')
    await screen.findByRole('heading', { level: 1, name: enSettings.titles.profile })
    expect(router.state.location.pathname).toBe('/settings/profile')
  })

  it('shows the chat id on a chat page', async () => {
    mockBridge(withSession)
    renderAt('/chats/abc-123')
    expect(await screen.findByRole('heading', { name: enChat.titles.chat })).toBeInTheDocument()
    expect(screen.getByText('abc-123')).toBeInTheDocument()
  })
})

describe('providers', () => {
  it('reports network reachability through the bridge', async () => {
    mockBridge(withSession)
    renderAt('/chats')
    await screen.findByRole('heading', { name: enChat.titles.chats })
    expect(mockedInvoke).toHaveBeenCalledWith('set_network_reachable', { reachable: true })
  })

  it('applies the persisted dark theme', async () => {
    localStorage.setItem('gim.theme', 'dark')
    mockBridge(noSession)
    renderAt('/')
    await screen.findByRole('heading', { name: enOnboarding.titles.welcome })
    expect(document.documentElement).toHaveClass('dark')
  })
})
