/**
 * The "Link to existing device" flow on the new device as a pure state
 * machine: a reducer over `LinkState` and a driver that runs the bridge
 * calls. The api is injected so tests can drive it without React or Tauri.
 */

import type { GimError, LinkStart } from '@/lib/api'
import { isGimError } from '@/lib/api'

export type LinkFailure = 'timeout' | 'usedUp' | 'network' | 'other'

export type LinkState
  = | { status: 'idle' }
    | { status: 'starting' }
    | { status: 'showingQr', linkId: string, qrString: string }
    | { status: 'waiting', linkId: string, qrString: string }
    | { status: 'comparing', sas: string }
    | { status: 'confirming' }
    | { status: 'linked' }
    | { status: 'rejected' }
    | { status: 'failed', reason: LinkFailure, error?: GimError }

export type LinkAction
  = | { type: 'start' }
    | { type: 'started', linkId: string, qrString: string }
    | { type: 'waiting' }
    | { type: 'sas', sas: string }
    | { type: 'confirm' }
    | { type: 'linked' }
    | { type: 'rejected' }
    | { type: 'failed', reason: LinkFailure, error?: GimError }
    | { type: 'reset' }

export interface LinkApi {
  startLink: (hubs: string[]) => Promise<LinkStart>
  waitLink: (linkId: string) => Promise<string>
  confirmLink: (accepted: boolean) => Promise<void>
}

export function reduce(state: LinkState, action: LinkAction): LinkState {
  switch (action.type) {
    case 'start':
      return { status: 'starting' }
    case 'started':
      return { status: 'showingQr', linkId: action.linkId, qrString: action.qrString }
    case 'waiting':
      return state.status === 'showingQr'
        ? { ...state, status: 'waiting' }
        : state
    case 'sas':
      return { status: 'comparing', sas: action.sas }
    case 'confirm':
      return { status: 'confirming' }
    case 'linked':
      return { status: 'linked' }
    case 'rejected':
      return { status: 'rejected' }
    case 'failed':
      return action.error
        ? { status: 'failed', reason: action.reason, error: action.error }
        : { status: 'failed', reason: action.reason }
    case 'reset':
      return { status: 'idle' }
  }
}

function isTimeout(error: unknown): boolean {
  if (!isGimError(error))
    return false
  if (error.kind === 'Network')
    return true
  return /timed out|timeout/i.test(error.message)
}

function failure(error: unknown, reason: LinkFailure): LinkAction {
  return isGimError(error)
    ? { type: 'failed', reason, error }
    : { type: 'failed', reason }
}

/** Failure of a call other than `waitLink`. */
function callFailure(error: unknown): LinkAction {
  const reason: LinkFailure = isGimError(error) && error.kind === 'Network'
    ? 'network'
    : 'other'
  return failure(error, reason)
}

export interface LinkFlow {
  getState: () => LinkState
  /** Starts a new link session (a new QR code); also used for every retry. */
  start: () => Promise<void>
  /** "The codes match". */
  confirm: () => Promise<void>
  /** "They don't match": wipes the device like sign out. */
  reject: () => Promise<void>
  /** Abandons a pending call; its later result is ignored. */
  cancel: () => void
}

export function createLinkFlow(api: LinkApi, hubs: string[], onChange: (state: LinkState) => void): LinkFlow {
  let state: LinkState = { status: 'idle' }
  let generation = 0

  function dispatch(action: LinkAction) {
    state = reduce(state, action)
    onChange(state)
  }

  async function start() {
    const current = ++generation
    dispatch({ type: 'start' })
    let started: LinkStart
    try {
      started = await api.startLink(hubs)
    }
    catch (error) {
      if (current === generation)
        dispatch(callFailure(error))
      return
    }
    if (current !== generation)
      return
    dispatch({ type: 'started', ...started })
    dispatch({ type: 'waiting' })
    try {
      const sas = await api.waitLink(started.linkId)
      if (current === generation)
        dispatch({ type: 'sas', sas })
    }
    catch (error) {
      if (current !== generation)
        return
      // A session that failed after the bundle arrived is used up; a new
      // startLink is the right retry in both cases.
      dispatch(failure(error, isTimeout(error)
        ? 'timeout'
        : 'usedUp'))
    }
  }

  async function confirm() {
    const current = ++generation
    dispatch({ type: 'confirm' })
    try {
      await api.confirmLink(true)
      if (current === generation)
        dispatch({ type: 'linked' })
    }
    catch (error) {
      if (current === generation)
        dispatch(callFailure(error))
    }
  }

  async function reject() {
    const current = ++generation
    try {
      await api.confirmLink(false)
      if (current === generation)
        dispatch({ type: 'rejected' })
    }
    catch (error) {
      if (current === generation)
        dispatch(callFailure(error))
    }
  }

  function cancel() {
    generation++
    dispatch({ type: 'reset' })
  }

  return {
    getState: () => state,
    start,
    confirm,
    reject,
    cancel,
  }
}
