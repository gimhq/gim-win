import type { GimError, ParsedRecoveryKit, Session, StartupInfo } from '@/lib/api'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Providers } from '@/app/providers'
import { routeTree } from '@/app/routeTree.gen'
import en from '@/i18n/locales/en/onboarding.json'

const configured: StartupInfo = {
  serverUrl: 'https://hub.example',
  clientReady: true,
  localStateReset: false,
  session: null,
  error: null,
}

const restored: Session = {
  userId: 'u-user-1',
  deviceId: 'device-1',
  displayName: 'Roy',
}

const USER_ID = 'u-user-1'
const CODE = 'ABCD1234EFGH5678'

/** Finds the id and the code in text the same way for the pasted kit and the fallback fields. */
function parse(text: string): ParsedRecoveryKit {
  return {
    userId: text.includes(USER_ID)
      ? USER_ID
      : null,
    recoveryCode: text.includes('ABCD-1234-EFGH-5678') || text.includes(CODE)
      ? CODE
      : null,
  }
}

interface Bridge {
  info?: StartupInfo
  restore?: () => Promise<void>
}

function mockBridge({ info = configured, restore = async () => {} }: Bridge = {}) {
  let current = info
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    switch (command) {
      case 'startup':
        return current
      case 'set_server_url':
        return configured
      case 'parse_recovery_kit':
        return parse((args as { text: string }).text)
      case 'restore_from_recovery':
        await restore()
        current = { ...configured, session: restored }
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

async function pasteKit(text = `gim recovery kit\nAccount ID: ${USER_ID}\nRecovery key: ABCD-1234-EFGH-5678`) {
  fireEvent.change(await screen.findByLabelText(en.restore.kitLabel), {
    target: { value: text },
  })
}

beforeEach(() => {
  vi.mocked(invoke).mockReset()
})

describe('restore page', () => {
  it('fills the fields from the pasted kit and restores with revokeOthers', async () => {
    mockBridge()
    const router = renderAt('/onboarding/restore')
    expect(await screen.findByRole('heading', { level: 1, name: en.restore.title })).toBeInTheDocument()

    await pasteKit()
    expect(await screen.findByText(en.restore.kitFound)).toBeInTheDocument()
    expect(screen.getByLabelText(en.restore.userIdLabel)).toHaveValue(USER_ID)
    expect(screen.getByLabelText(en.restore.recoveryCodeLabel)).toHaveValue(CODE)

    fireEvent.click(screen.getByRole('checkbox', { name: en.restore.revokeOthers }))
    fireEvent.click(screen.getByRole('button', { name: en.restore.submit }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats'))
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('restore_from_recovery', {
      userId: USER_ID,
      recoveryCode: CODE,
      revokeOthers: true,
    })
  })

  it('shows the status line for a partial or unknown paste', async () => {
    mockBridge()
    renderAt('/onboarding/restore')
    await pasteKit(`Account ID: ${USER_ID}`)
    expect(await screen.findByText(en.restore.kitIncomplete)).toBeInTheDocument()
    await pasteKit('hello')
    expect(await screen.findByText(en.restore.kitNotRecognized)).toBeInTheDocument()
  })

  it('shows the NotFound copy and retries with the same inputs', async () => {
    const notFound: GimError = { kind: 'NotFound', message: 'not found', reason: 'not found' }
    let calls = 0
    mockBridge({
      restore: async () => {
        calls++
        if (calls === 1)
          throw notFound
      },
    })
    const router = renderAt('/onboarding/restore')
    fireEvent.change(await screen.findByLabelText(en.restore.userIdLabel), {
      target: { value: USER_ID },
    })
    fireEvent.change(screen.getByLabelText(en.restore.recoveryCodeLabel), {
      target: { value: 'abcd-1234-efgh-5678' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.restore.submit }))
    expect(await screen.findByText(en.restore.unknownUser)).toBeInTheDocument()
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('restore_from_recovery', {
      userId: USER_ID,
      recoveryCode: 'abcd-1234-efgh-5678',
      revokeOthers: false,
    })
    fireEvent.click(screen.getByRole('button', { name: en.restore.submit }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/chats'))
  })

  it('asks for the server first when the client could not be created', async () => {
    mockBridge({
      info: { ...configured, clientReady: false },
    })
    renderAt('/onboarding/restore')
    fireEvent.change(await screen.findByLabelText(en.server.label), {
      target: { value: 'https://hub.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.server.continue }))
    expect(await screen.findByLabelText(en.restore.kitLabel)).toBeInTheDocument()
  })
})
