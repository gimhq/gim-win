import type { EventCallback } from '@tauri-apps/api/event'
import type { HubInfo } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Providers } from '@/app/providers'
import enCommon from '@/i18n/locales/en/common.json'
import enSettings from '@/i18n/locales/en/settings.json'
import { EVENT_HUB_LIST } from '@/lib/api'
import { ServersSection } from './servers-section'

const mockedInvoke = vi.mocked(invoke)
const mockedListen = vi.mocked(listen)

const HUBS: HubInfo[] = [
  {
    hubId: 'hub-b',
    url: null,
    state: 'Unverified',
    priority: 1,
    isPrimary: false,
    isHome: false,
    signedIn: false,
  },
  {
    hubId: 'hub-a',
    url: 'https://a.example',
    state: 'Verified',
    priority: 0,
    isPrimary: true,
    isHome: true,
    signedIn: true,
  },
]

let handlers: Record<string, EventCallback<unknown>>
/** Bridge errors to reject a command with, by command name; `undefined` resolves with `null`. */
let failures: Record<string, (args: unknown) => unknown>

beforeEach(() => {
  handlers = {}
  failures = {}
  mockedListen.mockReset()
  mockedListen.mockImplementation(async (event, handler) => {
    handlers[event] = handler as EventCallback<unknown>
    return () => {}
  })
  mockedInvoke.mockReset()
  mockedInvoke.mockImplementation(async (command, args) => {
    if (command === 'subscribe_hub_list')
      return 's1'
    const error = failures[command]?.(args)
    if (error !== undefined)
      throw error
    return null
  })
})

async function renderSection() {
  render(
    <Providers>
      <ServersSection />
    </Providers>,
  )
  await vi.waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('subscribe_hub_list', undefined))
  act(() => {
    handlers[EVENT_HUB_LIST]({
      event: EVENT_HUB_LIST,
      id: 1,
      payload: { subscriptionId: 's1', hubs: HUBS },
    })
  })
}

function row(name: string): HTMLElement {
  return screen.getByText(name).closest('li') as HTMLElement
}

async function openRemove(name: string) {
  fireEvent.click(within(row(name)).getByRole('button', { name: enCommon.actions.remove }))
  return screen.findByRole('alertdialog')
}

describe('serversSection', () => {
  it('lists the servers with their state and the main server first', async () => {
    await renderSection()
    expect(screen.getByRole('heading', { level: 1, name: enSettings.titles.advanced })).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('https://a.example')
    expect(items[0]).toHaveTextContent(enSettings.advanced.state.connected)
    expect(items[0]).toHaveTextContent(enSettings.advanced.mainServer)
    expect(items[1]).toHaveTextContent('hub-b')
    expect(items[1]).toHaveTextContent(enSettings.advanced.state.notChecked)
    expect(items[1]).not.toHaveTextContent(enSettings.advanced.mainServer)
    expect(within(items[0]).queryByRole('button', { name: enSettings.advanced.makeMain })).toBeNull()
  })

  it('makes a server main', async () => {
    await renderSection()
    fireEvent.click(within(row('hub-b')).getByRole('button', { name: enSettings.advanced.makeMain }))
    await vi.waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('set_primary_hub', { hubId: 'hub-b' }))
  })

  it('removes a server after confirming', async () => {
    await renderSection()
    const dialog = await openRemove('hub-b')
    expect(dialog).toHaveTextContent(enSettings.advanced.removeTitle)
    expect(dialog).toHaveTextContent(enSettings.advanced.removeBody)
    fireEvent.click(within(dialog).getByRole('button', { name: enCommon.actions.remove }))
    await vi.waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('remove_hub', { hubId: 'hub-b', confirmOwnedGroups: false }))
  })

  it('asks again when the server owns groups', async () => {
    failures.remove_hub = (args) => {
      if ((args as { confirmOwnedGroups: boolean }).confirmOwnedGroups)
        return undefined
      return {
        kind: 'HubOwnsGroups',
        message: 'm',
        hubId: 'hub-b',
        groupCount: 2,
      }
    }
    await renderSection()
    const dialog = await openRemove('hub-b')
    fireEvent.click(within(dialog).getByRole('button', { name: enCommon.actions.remove }))
    const anyway = await screen.findByRole('button', { name: enSettings.advanced.removeAnyway })
    expect(screen.getByRole('alertdialog')).toHaveTextContent(enSettings.advanced.ownsGroupsTitle)
    expect(screen.getByRole('alertdialog')).toHaveTextContent(enSettings.advanced.ownsGroupsBody_other.replace('{{count}}', '2'))
    fireEvent.click(anyway)
    await vi.waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('remove_hub', { hubId: 'hub-b', confirmOwnedGroups: true }))
  })

  it('shows the home server text when removing the home server', async () => {
    failures.remove_hub = () => ({ kind: 'HomeHub', message: 'm', hubId: 'hub-a' })
    await renderSection()
    const dialog = await openRemove('https://a.example')
    fireEvent.click(within(dialog).getByRole('button', { name: enCommon.actions.remove }))
    expect(await within(row('https://a.example')).findByText(enSettings.advanced.errors.homeHub)).toBeInTheDocument()
    expect(screen.queryByText('HomeHub')).toBeNull()
  })

  it('adds a server once the address is valid', async () => {
    await renderSection()
    const input = screen.getByLabelText(enSettings.advanced.serverUrl)
    const add = screen.getByRole('button', { name: enCommon.actions.add })
    fireEvent.change(input, {
      target: { value: 'not a url' },
    })
    expect(add).toBeDisabled()
    fireEvent.change(input, {
      target: { value: 'https://hub.example' },
    })
    expect(add).toBeEnabled()
    fireEvent.click(add)
    await vi.waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('add_hub', { url: 'https://hub.example' }))
  })

  it('shows the mapped text when adding fails', async () => {
    failures.add_hub = () => ({ kind: 'HubNotVerified', message: 'm', reason: 'r' })
    await renderSection()
    fireEvent.change(screen.getByLabelText(enSettings.advanced.serverUrl), {
      target: { value: 'https://hub.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: enCommon.actions.add }))
    expect(await screen.findByText(enSettings.advanced.errors.hubNotVerified)).toBeInTheDocument()
  })

  it('falls back to the hub list command when the subscription fails', async () => {
    mockedInvoke.mockImplementation(async (command) => {
      if (command === 'subscribe_hub_list')
        throw new Error('no stream')
      if (command === 'hubs')
        return HUBS
      return null
    })
    render(
      <Providers>
        <ServersSection />
      </Providers>,
    )
    expect(await screen.findByText('https://a.example')).toBeInTheDocument()
  })
})
