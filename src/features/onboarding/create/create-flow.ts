/**
 * The "Create account" flow as a pure state machine: name -> (server?) ->
 * creating -> kit (the kit screen runs its own check) -> done.
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
    | { step: 'done' }

export interface CreateApi {
  createIdentity: (displayName: string) => Promise<string>
  session: () => Promise<Session | null>
}

/** The server step is needed when the client could not be created. */
export function needsServer(info: StartupInfo): boolean {
  return !info.clientReady
}

/** The trimmed name if it has 1-64 characters, else `null`. */
export function validDisplayName(name: string): string | null {
  const trimmed = name.trim()
  const length = [...trimmed].length
  return length >= 1 && length <= 64
    ? trimmed
    : null
}

function createCopy(error: unknown): Copy {
  if (isGimError(error)) {
    if (error.kind === 'UserNotAdmitted')
      return { key: 'create.notAdmitted' }
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

  return {
    getState: () => state,
    openServer: () => set({ step: 'server', serverRequired: false }),
    cancelServer: () => set({ step: 'name', serverRequired: false }),
    serverDone: () => set({ step: 'name', serverRequired: false }),
    create,
    kitDone: () => set({ step: 'done' }),
  }
}
