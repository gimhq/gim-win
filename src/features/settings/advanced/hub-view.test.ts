import type { GimError, HubInfo } from '@/lib/api'
import { addErrorKey, hubStateLabelKey, isValidHubUrl, removeErrorKey, sortHubs } from './hub-view'

function hub(hubId: string, fields: Partial<HubInfo> = {}): HubInfo {
  return {
    hubId,
    url: `https://${hubId}.example`,
    state: 'Verified',
    priority: 1,
    isPrimary: false,
    isHome: false,
    signedIn: true,
    ...fields,
  }
}

describe('hubStateLabelKey', () => {
  it('maps every state to its label', () => {
    expect(hubStateLabelKey('Verified')).toBe('advanced.state.connected')
    expect(hubStateLabelKey('Unverified')).toBe('advanced.state.notChecked')
    expect(hubStateLabelKey('Removed')).toBe('advanced.state.removed')
  })
})

describe('sortHubs', () => {
  it('puts the main server first, then by priority, removed hubs last', () => {
    const sorted = sortHubs([
      hub('gone', { state: 'Removed', priority: 0 }),
      hub('c', { priority: 3 }),
      hub('main', { priority: 5, isPrimary: true }),
      hub('b', { priority: 2, state: 'Unverified' }),
    ])
    expect(sorted.map(h => h.hubId)).toEqual(['main', 'b', 'c', 'gone'])
  })

  it('does not modify the input list', () => {
    const input = [
      hub('b', { priority: 2 }),
      hub('a', { priority: 1 }),
    ]
    sortHubs(input)
    expect(input.map(h => h.hubId)).toEqual(['b', 'a'])
  })
})

describe('isValidHubUrl', () => {
  it.each([
    'https://hub.example',
    'http://hub.example',
    'https://hub.example:8443/path?q=1',
    'https://user@hub.example',
    'http://127.0.0.1:8008',
  ])('accepts %s', (url) => {
    expect(isValidHubUrl(url)).toBe(true)
  })

  it.each([
    '',
    'not a url',
    'hub.example',
    'ftp://hub.example',
    'https://',
    'https:///path',
    'https://:443',
    'https://hub .example',
    'https://hub.example/a b',
  ])('rejects %j', (url) => {
    expect(isValidHubUrl(url)).toBe(false)
  })
})

describe('error keys', () => {
  const error = (fields: Record<string, unknown>) => ({ message: 'm', ...fields }) as GimError

  it('maps remove errors', () => {
    expect(removeErrorKey(error({ kind: 'HomeHub', hubId: 'h' }))).toBe('advanced.errors.homeHub')
    expect(removeErrorKey(error({ kind: 'LastHub', hubId: 'h' }))).toBe('advanced.errors.lastHub')
    expect(removeErrorKey(error({ kind: 'HubNotDrained', hubId: 'h', reason: 'r' }))).toBe('advanced.errors.hubNotDrained')
    expect(removeErrorKey(error({ kind: 'Network', reason: 'r' }))).toBe('advanced.errors.generic')
  })

  it('maps add errors', () => {
    expect(addErrorKey(error({ kind: 'InvalidInput', reason: 'r' }))).toBe('common:errors.invalidUrl')
    expect(addErrorKey(error({ kind: 'HubNotVerified', reason: 'r' }))).toBe('advanced.errors.hubNotVerified')
    expect(addErrorKey(error({ kind: 'Network', reason: 'r' }))).toBe('common:errors.network')
    expect(addErrorKey(error({ kind: 'Internal', reason: 'r' }))).toBe('advanced.errors.generic')
  })
})
