/**
 * A failed bridge command rejects with `{ kind, message, ...fields }`: `kind`
 * is the gim-ffi `GimError` variant, `message` its Display text and the
 * variant's fields follow camelCased. See `docs/API.md` "Errors".
 */

import type { ChatState } from './types'

export type GimError
  = | { kind: 'Network', message: string, reason: string }
    | { kind: 'NotRegistered', message: string }
    | { kind: 'InvalidInput', message: string, reason: string }
    | { kind: 'NotFound', message: string, reason: string }
    | { kind: 'Crypto', message: string, reason: string }
    | { kind: 'Storage', message: string, reason: string }
    | { kind: 'Server', message: string, status: number, reason: string }
    | { kind: 'RetryLater', message: string, status: number, retryAfterSecs: number, reason: string }
    | { kind: 'Cancelled', message: string }
    | { kind: 'NotImplemented', message: string }
    | { kind: 'Internal', message: string, reason: string }
    | { kind: 'ChatNotActive', message: string, chatId: string, state: ChatState }
    | { kind: 'HubNotVerified', message: string, reason: string }
    | { kind: 'HubOwnsGroups', message: string, hubId: string, groupCount: number }
    | { kind: 'LastHub', message: string, hubId: string }
    | { kind: 'HomeHub', message: string, hubId: string }
    | { kind: 'HubNotDrained', message: string, hubId: string, reason: string }
    | { kind: 'UserSuspended', message: string, hubId: string }
    | { kind: 'UserNotAdmitted', message: string, hubId: string }
    | { kind: 'NotAdmittedByPeer', message: string, hubId: string, chatId: string }
    | { kind: 'ContactNotAdmitted', message: string, userIds: string[] }

export function isGimError(value: unknown): value is GimError {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { kind?: unknown }).kind === 'string'
    && typeof (value as { message?: unknown }).message === 'string'
}

export function errorKind(error: unknown): GimError['kind'] | 'Unknown' {
  return isGimError(error)
    ? error.kind
    : 'Unknown'
}
