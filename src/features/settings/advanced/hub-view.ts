import type { GimError, HubInfo, HubState } from '@/lib/api'

export type HubStateLabelKey = 'advanced.state.connected' | 'advanced.state.notChecked' | 'advanced.state.removed'

export type RemoveErrorKey = 'advanced.errors.homeHub' | 'advanced.errors.lastHub' | 'advanced.errors.hubNotDrained' | 'advanced.errors.generic'

export type AddErrorKey = 'common:errors.invalidUrl' | 'advanced.errors.hubNotVerified' | 'common:errors.network' | 'advanced.errors.generic'

const STATE_LABEL_KEYS: Record<HubState, HubStateLabelKey> = {
  Verified: 'advanced.state.connected',
  Unverified: 'advanced.state.notChecked',
  Removed: 'advanced.state.removed',
}

export function hubStateLabelKey(state: HubState): HubStateLabelKey {
  return STATE_LABEL_KEYS[state]
}

function rank(hub: HubInfo): number {
  if (hub.state === 'Removed')
    return 2
  return hub.isPrimary
    ? 0
    : 1
}

/** Main server first, then by `priority` ascending, removed hubs last. Returns a new array. */
export function sortHubs(hubs: readonly HubInfo[]): HubInfo[] {
  return [...hubs].sort((a, b) => rank(a) - rank(b) || a.priority - b.priority)
}

/** `http://` or `https://` with a host and no whitespace (the bridge's rule). */
export function isValidHubUrl(url: string): boolean {
  if (/\s/.test(url))
    return false
  const match = /^https?:\/\/(.*)$/.exec(url)
  if (!match)
    return false
  const authority = match[1].split(/[/?#]/)[0]
  const hostPort = authority.slice(authority.lastIndexOf('@') + 1)
  const colon = hostPort.lastIndexOf(':')
  const host = colon === -1
    ? hostPort
    : hostPort.slice(0, colon)
  return host.length > 0
}

export function removeErrorKey(error: GimError): RemoveErrorKey {
  switch (error.kind) {
    case 'HomeHub':
      return 'advanced.errors.homeHub'
    case 'LastHub':
      return 'advanced.errors.lastHub'
    case 'HubNotDrained':
      return 'advanced.errors.hubNotDrained'
    default:
      return 'advanced.errors.generic'
  }
}

export function addErrorKey(error: GimError): AddErrorKey {
  switch (error.kind) {
    case 'InvalidInput':
      return 'common:errors.invalidUrl'
    case 'HubNotVerified':
      return 'advanced.errors.hubNotVerified'
    case 'Network':
      return 'common:errors.network'
    default:
      return 'advanced.errors.generic'
  }
}
