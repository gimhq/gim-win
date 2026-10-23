import { errorKind, isGimError } from './errors'

describe('isGimError', () => {
  it('accepts an object with string kind and message', () => {
    expect(isGimError({ kind: 'Network', message: 'offline', reason: 'offline' })).toBe(true)
    expect(isGimError({ kind: 'NotRegistered', message: 'no session' })).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isGimError(null)).toBe(false)
    expect(isGimError(undefined)).toBe(false)
    expect(isGimError('Network')).toBe(false)
    expect(isGimError(new Error('boom'))).toBe(false)
    expect(isGimError({ kind: 'Network' })).toBe(false)
    expect(isGimError({ kind: 7, message: 'x' })).toBe(false)
  })
})

describe('errorKind', () => {
  it('returns the kind of a GimError', () => {
    expect(errorKind({
      kind: 'ChatNotActive',
      message: 'left',
      chatId: 'c1',
      state: 'Left',
    })).toBe('ChatNotActive')
  })

  it('returns Unknown for anything else', () => {
    expect(errorKind(new Error('boom'))).toBe('Unknown')
    expect(errorKind('text')).toBe('Unknown')
  })
})
