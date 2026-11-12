import type { StartupInfo } from '@/lib/api'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'
import { render, screen } from '@testing-library/react'
import { Providers } from '@/app/providers'
import { routeTree } from '@/app/routeTree.gen'
import enChat from '@/i18n/locales/en/chat.json'
import { resetShortcuts } from '@/lib/shortcuts'
import { resetSyncForTests } from './sync'

const mockedInvoke = vi.mocked(invoke)

const withSession: StartupInfo = {
  serverUrl: 'https://hub.example',
  clientReady: true,
  localStateReset: false,
  session: {
    userId: 'user-1',
    deviceId: 'device-1',
    displayName: 'Roy',
  },
  error: null,
}

beforeEach(() => {
  resetSyncForTests()
  resetShortcuts()
  mockedInvoke.mockReset()
  // Every system command resolves to null, as the shared bridge mock does.
  mockedInvoke.mockImplementation(async command => command === 'startup'
    ? withSession
    : null)
})

describe('systemIntegration', () => {
  it('starts sync once and wires the system commands when the shell renders with a session', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/chats'],
      }),
    })
    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    )
    await screen.findByRole('heading', { name: enChat.titles.chats })

    await vi.waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith('set_tray_labels', { show: 'Show', hide: 'Hide', quit: 'Quit' })
      expect(mockedInvoke).toHaveBeenCalledWith('subscribe_chat_list', undefined)
    })
    expect(mockedInvoke.mock.calls.filter(([command]) => command === 'start_sync')).toHaveLength(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/settings/profile'))
  })
})
