import type { PrivacySettings, StartupInfo } from './types'
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

  it('deleteAccount invokes without arguments and returns the unreached hub ids', async () => {
    mockedInvoke.mockResolvedValueOnce(['h2'])
    await expect(commands.deleteAccount()).resolves.toEqual(['h2'])
    expect(mockedInvoke).toHaveBeenCalledWith('delete_account', undefined)
  })

  it('privacy invokes without arguments and returns the PrivacySettings', async () => {
    const settings: PrivacySettings = {
      readReceipts: true,
      typingIndicators: false,
      blockedUserIds: ['u2'],
    }
    mockedInvoke.mockResolvedValueOnce(settings)
    await expect(commands.privacy()).resolves.toEqual(settings)
    expect(mockedInvoke).toHaveBeenCalledWith('privacy', undefined)
  })

  it('setChatMuted passes chatId and mutedUntilMs', async () => {
    mockedInvoke.mockResolvedValueOnce(undefined)
    await commands.setChatMuted('c1', 1_700_000_000_000)
    expect(mockedInvoke).toHaveBeenCalledWith('set_chat_muted', { chatId: 'c1', mutedUntilMs: 1_700_000_000_000 })
  })

  it('reportUser passes userId, reason, note and messageIds and returns the report id', async () => {
    mockedInvoke.mockResolvedValueOnce('r1')
    await expect(commands.reportUser('u2', 'Spam', null, ['m1', 'm2'])).resolves.toBe('r1')
    expect(mockedInvoke).toHaveBeenCalledWith('report_user', {
      userId: 'u2',
      reason: 'Spam',
      note: null,
      messageIds: ['m1', 'm2'],
    })
  })

  it('fetchUserAvatar passes userId and destPath and returns the file path', async () => {
    mockedInvoke.mockResolvedValueOnce('/tmp/a.jpg')
    await expect(commands.fetchUserAvatar('u2', '/tmp/a.jpg')).resolves.toBe('/tmp/a.jpg')
    expect(mockedInvoke).toHaveBeenCalledWith('fetch_user_avatar', { userId: 'u2', destPath: '/tmp/a.jpg' })
  })
})

describe('muted helpers', () => {
  const now = 1_700_000_000_000
  // u64::MAX as the bridge serialises it and JSON.parse reads it back.
  const u64Max = JSON.parse('18446744073709551615') as number

  it('isMutedForever is false for 0 and for timestamps', () => {
    expect(commands.isMutedForever(0)).toBe(false)
    expect(commands.isMutedForever(now - 1000)).toBe(false)
    expect(commands.isMutedForever(now + 1000)).toBe(false)
  })

  it('isMutedForever is true from 2^53 upwards, u64::MAX included', () => {
    expect(commands.isMutedForever(2 ** 53)).toBe(true)
    expect(commands.isMutedForever(Number.MAX_SAFE_INTEGER)).toBe(true)
    expect(u64Max).toBeGreaterThan(Number.MAX_SAFE_INTEGER)
    expect(commands.isMutedForever(u64Max)).toBe(true)
  })

  it('isMuted is false for 0 and for a past time', () => {
    expect(commands.isMuted(0, now)).toBe(false)
    expect(commands.isMuted(now - 1000, now)).toBe(false)
    expect(commands.isMuted(now, now)).toBe(false)
  })

  it('isMuted is true for a future time, 2^53 and u64::MAX', () => {
    expect(commands.isMuted(now + 1000, now)).toBe(true)
    expect(commands.isMuted(2 ** 53, now)).toBe(true)
    expect(commands.isMuted(u64Max, now)).toBe(true)
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
