import type { LinkApproval } from '@/lib/api'

/** Old-device side of linking: paste the code, compare the SAS, then accept or reject. */
export type LinkState
  = | { step: 'idle' }
    | { step: 'approving' }
    | { step: 'comparing', approval: LinkApproval }
    | { step: 'confirming', approval: LinkApproval, accepted: boolean }
    | { step: 'linked' }
    | { step: 'rejected' }
    /** `approval` is set when the confirmation failed; the user may choose again. */
    | { step: 'failed', error: unknown, approval?: LinkApproval }

export type LinkEvent
  = | { type: 'submit' }
    | { type: 'approved', approval: LinkApproval }
    | { type: 'choose', accepted: boolean }
    | { type: 'confirmed' }
    | { type: 'failed', error: unknown }
    | { type: 'reset' }

export const initialLinkState: LinkState = { step: 'idle' }

export function linkReducer(state: LinkState, event: LinkEvent): LinkState {
  switch (event.type) {
    case 'submit':
      return state.step === 'idle' || (state.step === 'failed' && !state.approval)
        ? { step: 'approving' }
        : state
    case 'approved':
      return state.step === 'approving'
        ? { step: 'comparing', approval: event.approval }
        : state
    case 'choose': {
      const approval = state.step === 'comparing' || state.step === 'failed'
        ? state.approval
        : undefined
      return approval
        ? { step: 'confirming', approval, accepted: event.accepted }
        : state
    }
    case 'confirmed':
      if (state.step !== 'confirming')
        return state
      return state.accepted
        ? { step: 'linked' }
        : { step: 'rejected' }
    case 'failed':
      if (state.step === 'approving')
        return { step: 'failed', error: event.error }
      if (state.step === 'confirming')
        return { step: 'failed', error: event.error, approval: state.approval }
      return state
    case 'reset':
      return initialLinkState
  }
}

/** The approval to reject when the dialog closes before the user chose. */
export function pendingApprovalId(state: LinkState): string | null {
  if (state.step === 'comparing' || state.step === 'failed')
    return state.approval?.approvalId ?? null
  return null
}
