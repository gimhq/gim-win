import type { StartupInfo } from './types'
import { invoke } from '@tauri-apps/api/core'
import * as commands from './commands'

vi.mock('@tauri-apps/api/core')

const mockedInvoke = vi.mocked(invoke)

beforeEach(() => {
  mockedInvoke.mockReset()
})

describe('commands', () => {
  it('startup invokes without arguments and returns the StartupInfo', async () => {
    const info: StartupInfo = {
      serverUrl: 'https://hub.example',
      clientReady: true,
      localStateReset: false,
      session: null,
      error: null,
    }
    mockedInvoke.mockResolvedValueOnce(info)
    await expect(commands.startup()).resolves.toEqual(info)
    expect(mockedInvoke).toHaveBeenCalledWith('startup', undefined)
  })

  it('createIdentity passes displayName and returns the recovery code', async () => {
    mockedInvoke.mockResolvedValueOnce('word1 word2')
    await expect(commands.createIdentity('Roy')).resolves.toBe('word1 word2')
    expect(mockedInvoke).toHaveBeenCalledWith('create_identity', { displayName: 'Roy' })
  })

  it('startLink passes the hub list and returns the LinkStart', async () => {
    const link = { linkId: 'l1', qrString: 'gim:...' }
    mockedInvoke.mockResolvedValueOnce(link)
    await expect(commands.startLink(['https://a', 'https://b'])).resolves.toEqual(link)
    expect(mockedInvoke).toHaveBeenCalledWith('start_link', {
      hubs: ['https://a', 'https://b'],
    })
  })

  it('removeHub passes hubId and confirmOwnedGroups', async () => {
    mockedInvoke.mockResolvedValueOnce(undefined)
    await expect(commands.removeHub('h1', true)).resolves.toBeUndefined()
    expect(mockedInvoke).toHaveBeenCalledWith('remove_hub', { hubId: 'h1', confirmOwnedGroups: true })
  })

  it('sendText passes chatId, body and a null replyTo', async () => {
    mockedInvoke.mockResolvedValueOnce('m1')
    await expect(commands.sendText('c1', 'hello', null)).resolves.toBe('m1')
    expect(mockedInvoke).toHaveBeenCalledWith('send_text', { chatId: 'c1', body: 'hello', replyTo: null })
  })

  it('paginateBackwards passes chatId and count and returns the flag', async () => {
    mockedInvoke.mockResolvedValueOnce(false)
    await expect(commands.paginateBackwards('c1', 50)).resolves.toBe(false)
    expect(mockedInvoke).toHaveBeenCalledWith('paginate_backwards', { chatId: 'c1', count: 50 })
  })

  it('subscribeChatList invokes the subscribe command and returns the id', async () => {
    mockedInvoke.mockResolvedValueOnce('s1')
    await expect(commands.subscribeChatList()).resolves.toBe('s1')
    expect(mockedInvoke).toHaveBeenCalledWith('subscribe_chat_list', undefined)
  })

  it('unsubscribe passes the subscriptionId', async () => {
    mockedInvoke.mockResolvedValueOnce(undefined)
    await commands.unsubscribe('s1')
    expect(mockedInvoke).toHaveBeenCalledWith('unsubscribe', { subscriptionId: 's1' })
  })
})

describe('command errors', () => {
  it('rethrows a GimError payload unchanged', async () => {
    const error = {
      kind: 'HubOwnsGroups',
      message: 'hub owns 2 groups',
      hubId: 'h1',
      groupCount: 2,
    }
    mockedInvoke.mockRejectedValueOnce(error)
    await expect(commands.removeHub('h1', false)).rejects.toBe(error)
  })

  it('wraps a plain Error as Internal', async () => {
    mockedInvoke.mockRejectedValueOnce(new Error('ipc broken'))
    await expect(commands.devices()).rejects.toEqual({
      kind: 'Internal',
      message: 'Error: ipc broken',
      reason: 'Error: ipc broken',
    })
  })

  it('wraps a string rejection as Internal', async () => {
    mockedInvoke.mockRejectedValueOnce('command not found')
    await expect(commands.hubs()).rejects.toEqual({
      kind: 'Internal',
      message: 'command not found',
      reason: 'command not found',
    })
  })
})
