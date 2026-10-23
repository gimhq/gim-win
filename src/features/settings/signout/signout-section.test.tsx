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

function mockBridge(signOut: () => Promise<unknown>) {
  mockedInvoke.mockImplementation(async (command) => {
    if (command === 'startup')
      return withSession
    if (command === 'sign_out')
      return signOut()
    return null
  })
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
