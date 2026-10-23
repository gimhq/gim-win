/**
 * The "Create account" flow as a pure state machine: name -> (server?) ->
 * creating -> kit (the kit screen runs its own check) -> handle -> done.
 * The api is injected so tests can drive it without React or Tauri.
 */

import type { Session, StartupInfo } from '@/lib/api'
import { isGimError } from '@/lib/api'

/** An onboarding i18n key and its interpolation values. */
export interface Copy {
  key: string
  values?: Record<string, unknown>
}

export type CreateState
  = | { step: 'server', serverRequired: boolean }
    | { step: 'name', serverRequired: boolean, error?: Copy }
    | { step: 'creating' }
    | { step: 'kit', userId: string, recoveryCode: string }
    | { step: 'handle', error?: Copy }
    | { step: 'claiming' }
    | { step: 'done' }

export interface CreateApi {
  createIdentity: (displayName: string) => Promise<string>
  session: () => Promise<Session | null>
  claimHandle: (handle: string) => Promise<void>
}

const HANDLE = /^[a-z0-9_]{3,32}$/

/** The server step is needed when no server is set or its client could not be created. */
export function needsServer(info: StartupInfo): boolean {
  return info.serverUrl == null || !info.clientReady
}

/** The trimmed name if it has 1-64 characters, else `null`. */
export function validDisplayName(name: string): string | null {
  const trimmed = name.trim()
  const length = [...trimmed].length
  return length >= 1 && length <= 64
    ? trimmed
    : null
}

export function isValidHandle(handle: string): boolean {
  return HANDLE.test(handle)
}

/** Copy shared by both calls: network, busy server, anything else. */
function commonCopy(error: unknown): Copy {
  if (isGimError(error)) {
    if (error.kind === 'Network')
      return { key: 'errors.network' }
    if (error.kind === 'RetryLater') {
      return {
        key: 'errors.retryLater',
        values: { seconds: error.retryAfterSecs },
      }
    }
  }
  return { key: 'common:errors.generic' }
}

function createCopy(error: unknown): Copy {
  return isGimError(error) && error.kind === 'UserNotAdmitted'
    ? { key: 'create.notAdmitted' }
    : commonCopy(error)
}

function claimCopy(error: unknown): Copy {
  if (isGimError(error)) {
    if (error.kind === 'Server' && error.status === 409)
      return { key: 'handle.taken' }
    if (error.kind === 'InvalidInput')
      return { key: 'handle.invalid' }
  }
  return commonCopy(error)
}

export interface CreateFlow {
  getState: () => CreateState
  openServer: () => void
  /** Leaves an optional server step without changes. */
  cancelServer: () => void
  serverDone: () => void
  /** Creates the identity; a failed attempt can simply be retried. */
  create: (displayName: string) => Promise<void>
  /** The kit was saved and checked. */
  kitDone: () => void
  claim: (handle: string) => Promise<void>
  skip: () => void
}

export function createCreateFlow(api: CreateApi, info: StartupInfo, onChange: (state: CreateState) => void): CreateFlow {
  let state: CreateState = needsServer(info)
    ? { step: 'server', serverRequired: true }
    : { step: 'name', serverRequired: false }
  // Kept once createIdentity succeeded, so a failed session read never
  // creates a second identity.
  let recoveryCode: string | null = null

  function set(next: CreateState) {
    state = next
    onChange(state)
  }

  async function create(displayName: string) {
    const name = validDisplayName(displayName)
    if (name === null) {
      set({
        step: 'name',
        serverRequired: false,
        error: { key: 'create.nameInvalid' },
      })
      return
    }
    set({ step: 'creating' })
    try {
      recoveryCode ??= await api.createIdentity(name)
    }
    catch (error) {
      set({
        step: 'name',
        serverRequired: false,
        error: createCopy(error),
      })
      return
    }
    try {
      const current = await api.session()
      if (!current)
        throw new Error('no session after createIdentity')
      set({ step: 'kit', userId: current.userId, recoveryCode })
    }
    catch {
      set({
        step: 'name',
        serverRequired: false,
        error: { key: 'common:errors.generic' },
      })
    }
  }

  async function claim(handle: string) {
    if (!isValidHandle(handle)) {
      set({
        step: 'handle',
        error: { key: 'handle.invalid' },
      })
      return
    }
    set({ step: 'claiming' })
    try {
      await api.claimHandle(handle)
      set({ step: 'done' })
    }
    catch (error) {
      set({
        step: 'handle',
        error: claimCopy(error),
      })
    }
  }

  return {
    getState: () => state,
    openServer: () => set({ step: 'server', serverRequired: false }),
    cancelServer: () => set({ step: 'name', serverRequired: false }),
    serverDone: () => set({ step: 'name', serverRequired: false }),
    create,
    kitDone: () => set({ step: 'handle' }),
    claim,
    skip: () => set({ step: 'done' }),
  }
}
