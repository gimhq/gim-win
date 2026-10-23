import type { StartupInfo } from '@/lib/api'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Providers } from '@/app/providers'
import { routeTree } from '@/app/routeTree.gen'
import enCommon from '@/i18n/locales/en/common.json'
import enOnboarding from '@/i18n/locales/en/onboarding.json'
import enSettings from '@/i18n/locales/en/settings.json'

const mockedInvoke = vi.mocked(invoke)

const withSession: StartupInfo = {
  serverUrl: 'https://hub.example',
  clientReady: true,
  localStateReset: false,
  session: {
    userId: 'user-1',
    deviceId: 'device-1',
    handle: '',
    displayName: 'Roy',
  },
  error: null,
}

function mockBridge(signOut: () => Promise<unknown>, searchReset: () => Promise<unknown> = async () => null) {
  mockedInvoke.mockImplementation(async (command) => {
    if (command === 'startup')
      return withSession
    if (command === 'sign_out')
      return signOut()
    if (command === 'search_reset')
      return searchReset()
    return null
  })
}

function commandOrder(): string[] {
  return mockedInvoke.mock.calls.map(([command]) => command)
}

function renderSignOut() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ['/settings/signout'],
    }),
  })
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
  return router
}

async function confirmSignOut() {
  await screen.findByRole('heading', { level: 1, name: enSettings.titles.signOut })
  expect(screen.getByText(enSettings.signOut.body)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: enSettings.signOut.confirm }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent(enSettings.signOut.title)
  expect(dialog).toHaveTextContent(enCommon.actions.cancel)
  const buttons = screen.getAllByRole('button', { name: enSettings.signOut.confirm })
  fireEvent.click(buttons.at(-1)!)
}

beforeEach(() => {
  mockedInvoke.mockReset()
})

describe('sign out section', () => {
  it('signs out after the confirmation and goes to onboarding', async () => {
    mockBridge(async () => null)
    const router = renderSignOut()
    await confirmSignOut()
    expect(await screen.findByRole('heading', { name: enOnboarding.titles.welcome })).toBeInTheDocument()
    expect(mockedInvoke).toHaveBeenCalledWith('sign_out', undefined)
    expect(router.state.location.pathname).toBe('/onboarding')
  })

  it('resets the search index after sign out', async () => {
    mockBridge(async () => null)
    renderSignOut()
    await confirmSignOut()
    await screen.findByRole('heading', { name: enOnboarding.titles.welcome })
    const commands = commandOrder()
    expect(commands).toContain('search_reset')
    expect(commands.indexOf('search_reset')).toBeGreaterThan(commands.indexOf('sign_out'))
  })

  it('still goes to onboarding when the search reset fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockBridge(async () => null, async () => {
      throw new Error('locked')
    })
    const router = renderSignOut()
    await confirmSignOut()
    expect(await screen.findByRole('heading', { name: enOnboarding.titles.welcome })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/onboarding')
    expect(error).toHaveBeenCalledWith('search_reset failed', expect.anything())
    error.mockRestore()
  })

  it('does not reset the search index when sign out fails', async () => {
    mockBridge(async () => {
      throw new Error('boom')
    })
    renderSignOut()
    await confirmSignOut()
    await screen.findByText(enCommon.errors.generic)
    expect(commandOrder()).not.toContain('search_reset')
  })

  it('stays on the page with the generic error when sign out fails', async () => {
    mockBridge(async () => {
      throw new Error('boom')
    })
    const router = renderSignOut()
    await confirmSignOut()
    expect(await screen.findByText(enCommon.errors.generic)).toBeInTheDocument()
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('sign_out', undefined))
    expect(router.state.location.pathname).toBe('/settings/signout')
  })
})
