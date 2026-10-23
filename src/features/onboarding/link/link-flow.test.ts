import type { LinkApi, LinkState } from './link-flow'
import type { GimError, LinkStart } from '@/lib/api'
import { createLinkFlow } from './link-flow'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const started: LinkStart = { linkId: 'link-1', qrString: 'gim:link:abc' }

function setup() {
  const waits: ReturnType<typeof deferred<string>>[] = []
  const api: LinkApi = {
    startLink: vi.fn(async () => started),
    waitLink: vi.fn(() => {
      const wait = deferred<string>()
      waits.push(wait)
      return wait.promise
    }),
    confirmLink: vi.fn(async () => {}),
  }
  const states: LinkState[] = []
  const flow = createLinkFlow(api, ['https://hub.example'], state => states.push(state))
  return { api, flow, states, waits }
}

async function settle() {
  for (let i = 0; i < 5; i++)
    await Promise.resolve()
}

describe('link flow', () => {
  it('reaches linked on the happy path', async () => {
    const { api, flow, states, waits } = setup()
    const run = flow.start()
    await settle()
    expect(api.startLink).toHaveBeenCalledWith(['https://hub.example'])
    expect(api.waitLink).toHaveBeenCalledWith('link-1')
    expect(flow.getState()).toEqual({ status: 'waiting', linkId: 'link-1', qrString: 'gim:link:abc' })

    waits[0]!.resolve('123 456')
    await run
    expect(flow.getState()).toEqual({ status: 'comparing', sas: '123 456' })

    await flow.confirm()
    expect(api.confirmLink).toHaveBeenCalledWith(true)
    expect(flow.getState()).toEqual({ status: 'linked' })
    expect(states.map(state => state.status)).toEqual([
      'starting',
      'showingQr',
      'waiting',
      'comparing',
      'confirming',
      'linked',
    ])
  })

  it('rejects with confirmLink(false)', async () => {
    const { api, flow, waits } = setup()
    const run = flow.start()
    await settle()
    waits[0]!.resolve('123 456')
    await run

    await flow.reject()
    expect(api.confirmLink).toHaveBeenCalledWith(false)
    expect(flow.getState()).toEqual({ status: 'rejected' })
  })

  it('fails with timeout when waiting runs out and retries with a new start', async () => {
    const { api, flow, waits } = setup()
    const run = flow.start()
    await settle()
    const timeout: GimError = { kind: 'Internal', message: 'link session timed out', reason: 'timed out' }
    waits[0]!.reject(timeout)
    await run
    expect(flow.getState()).toMatchObject({ status: 'failed', reason: 'timeout' })

    const retry = flow.start()
    await settle()
    expect(api.startLink).toHaveBeenCalledTimes(2)
    expect(api.waitLink).toHaveBeenCalledTimes(2)
    expect(flow.getState()).toEqual({ status: 'waiting', linkId: 'link-1', qrString: 'gim:link:abc' })
    waits[1]!.resolve('654 321')
    await retry
    expect(flow.getState()).toEqual({ status: 'comparing', sas: '654 321' })
  })

  it('treats a network error while waiting as a timeout', async () => {
    const { flow, waits } = setup()
    const run = flow.start()
    await settle()
    const network: GimError = { kind: 'Network', message: 'offline', reason: 'offline' }
    waits[0]!.reject(network)
    await run
    expect(flow.getState()).toMatchObject({ status: 'failed', reason: 'timeout' })
  })

  it('marks a used-up session when waiting fails for another reason', async () => {
    const { flow, waits } = setup()
    const run = flow.start()
    await settle()
    const bad: GimError = { kind: 'Crypto', message: 'bundle did not verify', reason: 'bad' }
    waits[0]!.reject(bad)
    await run
    expect(flow.getState()).toMatchObject({ status: 'failed', reason: 'usedUp' })
  })

  it('reports a network failure when starting fails', async () => {
    const { api, flow } = setup()
    const network: GimError = { kind: 'Network', message: 'offline', reason: 'offline' }
    vi.mocked(api.startLink).mockRejectedValueOnce(network)
    await flow.start()
    expect(flow.getState()).toEqual({ status: 'failed', reason: 'network', error: network })
    expect(api.waitLink).not.toHaveBeenCalled()
  })

  it('keeps the error of other failures for the copy', async () => {
    const { api, flow } = setup()
    const busy: GimError = {
      kind: 'RetryLater',
      message: 'busy',
      status: 503,
      retryAfterSecs: 30,
      reason: 'busy',
    }
    vi.mocked(api.startLink).mockRejectedValueOnce(busy)
    await flow.start()
    expect(flow.getState()).toEqual({ status: 'failed', reason: 'other', error: busy })
  })

  it('cancel abandons the pending wait', async () => {
    const { flow, states, waits } = setup()
    const run = flow.start()
    await settle()
    flow.cancel()
    expect(flow.getState()).toEqual({ status: 'idle' })
    const before = states.length

    waits[0]!.resolve('123 456')
    await run
    expect(flow.getState()).toEqual({ status: 'idle' })
    expect(states.length).toBe(before)
  })
})
