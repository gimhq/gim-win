import type { LinkApproval } from '@/lib/api'
import { initialLinkState, linkReducer, pendingApprovalId } from './link-device-flow'

const approval: LinkApproval = { approvalId: 'approval-1', sas: '123 456', deviceId: 'device-2' }
const offline = { kind: 'Network', message: 'down', reason: 'down' }

describe('link device flow', () => {
  it('approves, compares and links', () => {
    let state = linkReducer(initialLinkState, { type: 'submit' })
    expect(state).toEqual({ step: 'approving' })
    state = linkReducer(state, { type: 'approved', approval })
    expect(state).toEqual({ step: 'comparing', approval })
    state = linkReducer(state, { type: 'choose', accepted: true })
    expect(state).toEqual({ step: 'confirming', approval, accepted: true })
    state = linkReducer(state, { type: 'confirmed' })
    expect(state).toEqual({ step: 'linked' })
  })

  it('rejects when the codes do not match', () => {
    let state = linkReducer({ step: 'comparing', approval }, { type: 'choose', accepted: false })
    expect(state).toEqual({ step: 'confirming', approval, accepted: false })
    state = linkReducer(state, { type: 'confirmed' })
    expect(state).toEqual({ step: 'rejected' })
  })

  it('fails an approval and lets the user try again', () => {
    let state = linkReducer({ step: 'approving' }, { type: 'failed', error: offline })
    expect(state).toEqual({ step: 'failed', error: offline })
    state = linkReducer(state, { type: 'submit' })
    expect(state).toEqual({ step: 'approving' })
  })

  it('keeps the approval when the confirmation fails', () => {
    let state = linkReducer({ step: 'confirming', approval, accepted: true }, { type: 'failed', error: offline })
    expect(state).toEqual({ step: 'failed', error: offline, approval })
    state = linkReducer(state, { type: 'choose', accepted: true })
    expect(state).toEqual({ step: 'confirming', approval, accepted: true })
  })

  it('ignores events that do not fit the current step', () => {
    expect(linkReducer(initialLinkState, { type: 'confirmed' })).toBe(initialLinkState)
    expect(linkReducer(initialLinkState, { type: 'choose', accepted: true })).toBe(initialLinkState)
    const comparing = { step: 'comparing', approval } as const
    expect(linkReducer(comparing, { type: 'submit' })).toBe(comparing)
  })

  it('resets to idle', () => {
    expect(linkReducer({ step: 'linked' }, { type: 'reset' })).toEqual(initialLinkState)
  })

  it('reports an approval still waiting for a choice', () => {
    expect(pendingApprovalId(initialLinkState)).toBeNull()
    expect(pendingApprovalId({ step: 'comparing', approval })).toBe('approval-1')
    expect(pendingApprovalId({ step: 'failed', error: offline, approval })).toBe('approval-1')
    expect(pendingApprovalId({ step: 'failed', error: offline })).toBeNull()
    expect(pendingApprovalId({ step: 'confirming', approval, accepted: true })).toBeNull()
    expect(pendingApprovalId({ step: 'linked' })).toBeNull()
  })
})
