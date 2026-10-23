import type { ParsedRecoveryKit, RecoveryKitLabels } from './recovery-kit'
import { invoke } from '@tauri-apps/api/core'
import * as kit from './recovery-kit'

vi.mock('@tauri-apps/api/core')

const mockedInvoke = vi.mocked(invoke)

const labels: RecoveryKitLabels = {
  title: 'gim recovery kit',
  accountId: 'Account ID',
  recoveryKey: 'Recovery key',
  note: 'Keep this secret.',
}

beforeEach(() => {
  mockedInvoke.mockReset()
})

describe('recovery kit', () => {
  it('formatRecoveryKit passes userId, recoveryCode and labels and returns the text', async () => {
    mockedInvoke.mockResolvedValueOnce('gim recovery kit\n')
    await expect(kit.formatRecoveryKit('u1', 'CODE', labels)).resolves.toBe('gim recovery kit\n')
    expect(mockedInvoke).toHaveBeenCalledWith('format_recovery_kit', {
      userId: 'u1',
      recoveryCode: 'CODE',
      labels,
    })
  })

  it('parseRecoveryKit passes the text and returns the ParsedRecoveryKit', async () => {
    const parsed: ParsedRecoveryKit = { userId: 'u1', recoveryCode: null }
    mockedInvoke.mockResolvedValueOnce(parsed)
    await expect(kit.parseRecoveryKit('Account ID: u1')).resolves.toEqual(parsed)
    expect(mockedInvoke).toHaveBeenCalledWith('parse_recovery_kit', { text: 'Account ID: u1' })
  })

  it('recoveryKeyEnding passes the recoveryCode and returns the ending', async () => {
    mockedInvoke.mockResolvedValueOnce('MV7R')
    await expect(kit.recoveryKeyEnding('CODE')).resolves.toBe('MV7R')
    expect(mockedInvoke).toHaveBeenCalledWith('recovery_key_ending', { recoveryCode: 'CODE' })
  })

  it('matchesRecoveryKeyEnding passes recoveryCode and typed and returns the flag', async () => {
    mockedInvoke.mockResolvedValueOnce(true)
    await expect(kit.matchesRecoveryKeyEnding('CODE', 'v7r')).resolves.toBe(true)
    expect(mockedInvoke).toHaveBeenCalledWith('matches_recovery_key_ending', {
      recoveryCode: 'CODE',
      typed: 'v7r',
    })
  })

  it('saveTextFile passes defaultName and contents and returns the chosen path', async () => {
    mockedInvoke.mockResolvedValueOnce('/home/roy/kit.txt')
    await expect(kit.saveTextFile('kit.txt', 'text')).resolves.toBe('/home/roy/kit.txt')
    expect(mockedInvoke).toHaveBeenCalledWith('save_text_file', { defaultName: 'kit.txt', contents: 'text' })
  })

  it('saveTextFile returns null when the dialog was cancelled', async () => {
    mockedInvoke.mockResolvedValueOnce(null)
    await expect(kit.saveTextFile('kit.txt', 'text')).resolves.toBeNull()
  })

  it('wraps a non-GimError rejection as Internal', async () => {
    mockedInvoke.mockRejectedValueOnce(new Error('ipc down'))
    await expect(kit.parseRecoveryKit('x')).rejects.toMatchObject({
      kind: 'Internal',
      message: 'Error: ipc down',
    })
  })
})
