import type { CreateApi, CreateState } from './create-flow'
import type { GimError, Session, StartupInfo } from '@/lib/api'
import { createCreateFlow, isValidHandle, needsServer, validDisplayName } from './create-flow'

const configured: StartupInfo = {
  serverUrl: 'https://hub.example',
  clientReady: true,
  localStateReset: false,
  session: null,
  error: null,
}

const session: Session = {
  userId: 'user-1',
  deviceId: 'device-1',
  handle: '',
  displayName: 'Roy',
}

function gimError(error: Partial<GimError> & Pick<GimError, 'kind'>): GimError {
  return { message: 'raw', reason: 'raw', ...error } as GimError
}

function setup(info: StartupInfo = configured, overrides: Partial<CreateApi> = {}) {
  const api: CreateApi = {
    createIdentity: vi.fn(async () => 'ABCD1234EFGH5678'),
    session: vi.fn(async () => session),
    claimHandle: vi.fn(async () => {}),
    ...overrides,
  }
  const states: CreateState[] = []
  const flow = createCreateFlow(api, info, state => states.push(state))
  return { api, flow, states }
}

describe('create flow helpers', () => {
  it('needs the server step only without a ready client', () => {
    expect(needsServer(configured)).toBe(false)
    expect(needsServer({ ...configured, clientReady: false })).toBe(true)
  })

  it('validates the display name after trim', () => {
    expect(validDisplayName('  Roy  ')).toBe('Roy')
    expect(validDisplayName('   ')).toBeNull()
    expect(validDisplayName('x'.repeat(64))).toBe('x'.repeat(64))
    expect(validDisplayName('x'.repeat(65))).toBeNull()
  })

  it('validates the handle', () => {
    expect(isValidHandle('roy_42')).toBe(true)
    expect(isValidHandle('ro')).toBe(false)
    expect(isValidHandle('Roy')).toBe(false)
    expect(isValidHandle('x'.repeat(33))).toBe(false)
  })
})

describe('create flow', () => {
  it('skips the server step when a server is configured', async () => {
    const { api, flow, states } = setup()
    expect(flow.getState()).toEqual({ step: 'name', serverRequired: false })

    await flow.create('  Roy ')
    expect(api.createIdentity).toHaveBeenCalledWith('Roy')
    expect(flow.getState()).toEqual({ step: 'kit', userId: 'user-1', recoveryCode: 'ABCD1234EFGH5678' })

    flow.kitDone()
    expect(flow.getState()).toEqual({ step: 'handle' })
    await flow.claim('roy_42')
    expect(api.claimHandle).toHaveBeenCalledWith('roy_42')
    expect(flow.getState()).toEqual({ step: 'done' })
    expect(states.map(state => state.step)).toEqual([
      'creating',
      'kit',
      'handle',
      'claiming',
      'done',
    ])
  })

  it('starts with the server step when none is configured', () => {
    const { flow } = setup({ ...configured, clientReady: false })
    expect(flow.getState()).toEqual({ step: 'server', serverRequired: true })
    flow.serverDone()
    expect(flow.getState()).toEqual({ step: 'name', serverRequired: false })
  })

  it('opens the server step on request and comes back', () => {
    const { flow } = setup()
    flow.openServer()
    expect(flow.getState()).toEqual({ step: 'server', serverRequired: false })
    flow.cancelServer()
    expect(flow.getState()).toEqual({ step: 'name', serverRequired: false })
  })

  it('rejects an invalid name without calling the bridge', async () => {
    const { api, flow } = setup()
    await flow.create('   ')
    expect(api.createIdentity).not.toHaveBeenCalled()
    expect(flow.getState()).toEqual({
      step: 'name',
      serverRequired: false,
      error: { key: 'create.nameInvalid' },
    })
  })

  it('maps createIdentity errors and retries', async () => {
    const createIdentity = vi.fn<CreateApi['createIdentity']>()
      .mockRejectedValueOnce(gimError({ kind: 'Network' }))
      .mockRejectedValueOnce(gimError({ kind: 'RetryLater', status: 503, retryAfterSecs: 30 }))
      .mockRejectedValueOnce(gimError({ kind: 'UserNotAdmitted', hubId: 'hub-1' }))
      .mockRejectedValueOnce(gimError({ kind: 'Crypto' }))
      .mockResolvedValueOnce('ABCD1234EFGH5678')
    const { flow } = setup(configured, { createIdentity })

    await flow.create('Roy')
    expect(flow.getState()).toEqual({
      step: 'name',
      serverRequired: false,
      error: { key: 'errors.network' },
    })
    await flow.create('Roy')
    expect(flow.getState()).toEqual({
      step: 'name',
      serverRequired: false,
      error: {
        key: 'errors.retryLater',
        values: { seconds: 30 },
      },
    })
    await flow.create('Roy')
    expect(flow.getState()).toEqual({
      step: 'name',
      serverRequired: false,
      error: { key: 'create.notAdmitted' },
    })
    await flow.create('Roy')
    expect(flow.getState()).toEqual({
      step: 'name',
      serverRequired: false,
      error: { key: 'common:errors.generic' },
    })
    await flow.create('Roy')
    expect(flow.getState()).toMatchObject({ step: 'kit', recoveryCode: 'ABCD1234EFGH5678' })
    expect(createIdentity).toHaveBeenCalledTimes(5)
  })

  it('does not create a second identity when only the session read failed', async () => {
    const read = vi.fn<CreateApi['session']>()
      .mockRejectedValueOnce(gimError({ kind: 'Storage' }))
      .mockResolvedValueOnce(session)
    const { api, flow } = setup(configured, { session: read })
    await flow.create('Roy')
    expect(flow.getState()).toEqual({
      step: 'name',
      serverRequired: false,
      error: { key: 'common:errors.generic' },
    })
    await flow.create('Roy')
    expect(api.createIdentity).toHaveBeenCalledTimes(1)
    expect(flow.getState()).toMatchObject({ step: 'kit', userId: 'user-1' })
  })

  it('shows the taken copy for a 409 and lets the user skip', async () => {
    const { api, flow } = setup(configured, {
      claimHandle: vi.fn(async () => {
        throw gimError({ kind: 'Server', status: 409 })
      }),
    })
    await flow.create('Roy')
    flow.kitDone()
    await flow.claim('roy')
    expect(flow.getState()).toEqual({
      step: 'handle',
      error: { key: 'handle.taken' },
    })

    await flow.claim('No')
    expect(api.claimHandle).toHaveBeenCalledTimes(1)
    expect(flow.getState()).toEqual({
      step: 'handle',
      error: { key: 'handle.invalid' },
    })

    flow.skip()
    expect(flow.getState()).toEqual({ step: 'done' })
  })
})
