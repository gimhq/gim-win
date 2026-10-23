import { invoke } from '@tauri-apps/api/core'
import { ensureSyncStarted, markSyncStopped, resetSyncForTests } from './sync'

const mockedInvoke = vi.mocked(invoke)

function startSyncCalls(): number {
  return mockedInvoke.mock.calls.filter(([command]) => command === 'start_sync').length
}

beforeEach(() => {
  resetSyncForTests()
  mockedInvoke.mockReset()
  mockedInvoke.mockResolvedValue(null)
})

describe('ensureSyncStarted', () => {
  it('invokes start_sync on the first call', async () => {
    await ensureSyncStarted()
    expect(startSyncCalls()).toBe(1)
  })

  it('invokes start_sync once for concurrent calls', async () => {
    await Promise.all([
      ensureSyncStarted(),
      ensureSyncStarted(),
    ])
    expect(startSyncCalls()).toBe(1)
  })

  it('does not start again after a success', async () => {
    await ensureSyncStarted()
    await ensureSyncStarted()
    expect(startSyncCalls()).toBe(1)
  })

  it('retries on the next call after a failed start', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockedInvoke.mockRejectedValueOnce({ kind: 'Network', message: 'offline' })
    await expect(ensureSyncStarted()).resolves.toBeUndefined()
    expect(error).toHaveBeenCalled()
    await ensureSyncStarted()
    expect(startSyncCalls()).toBe(2)
    error.mockRestore()
  })

  it('starts again after markSyncStopped', async () => {
    await ensureSyncStarted()
    markSyncStopped()
    await ensureSyncStarted()
    expect(startSyncCalls()).toBe(2)
  })
})
