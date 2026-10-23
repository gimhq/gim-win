import type { GimError } from '@/lib/api'
import { fillFields, kitStatus, normalizeText, restoreCopy, restorePayload } from './restore-flow'

const empty = { userId: '', recoveryCode: '' }

describe('fillFields', () => {
  it('fills both fields from a parsed kit', () => {
    expect(fillFields({ userId: 'old', recoveryCode: 'old' }, { userId: 'u1', recoveryCode: 'CODE' }))
      .toEqual({ userId: 'u1', recoveryCode: 'CODE' })
  })

  it('keeps what the user typed when a part was not found', () => {
    expect(fillFields({ userId: 'typed', recoveryCode: '' }, { userId: null, recoveryCode: 'CODE' }))
      .toEqual({ userId: 'typed', recoveryCode: 'CODE' })
    expect(fillFields(empty, { userId: null, recoveryCode: null })).toEqual(empty)
  })
})

describe('kitStatus', () => {
  it('is null while nothing is pasted', () => {
    expect(kitStatus('  ', { userId: null, recoveryCode: null })).toBeNull()
  })

  it('selects the status line from what was found', () => {
    expect(kitStatus('kit', { userId: 'u1', recoveryCode: 'CODE' })).toBe('restore.kitFound')
    expect(kitStatus('kit', { userId: null, recoveryCode: null })).toBe('restore.kitNotRecognized')
    expect(kitStatus('kit', { userId: 'u1', recoveryCode: null })).toBe('restore.kitIncomplete')
    expect(kitStatus('kit', { userId: null, recoveryCode: 'CODE' })).toBe('restore.kitIncomplete')
  })
})

describe('restorePayload', () => {
  it('uses the parsed values when found', () => {
    expect(restorePayload({ userId: ' u1 ', recoveryCode: 'abcd-efgh' }, { userId: 'u1', recoveryCode: 'ABCDEFGH' }))
      .toEqual({ userId: 'u1', recoveryCode: 'ABCDEFGH' })
  })

  it('falls back to the trimmed raw fields so the SDK reports InvalidInput', () => {
    expect(restorePayload({ userId: ' bad ', recoveryCode: ' short ' }, { userId: null, recoveryCode: null }))
      .toEqual({ userId: 'bad', recoveryCode: 'short' })
  })

  it('joins both fields into one text to parse', () => {
    expect(normalizeText({ userId: 'u1', recoveryCode: 'CODE' })).toBe('u1\nCODE')
  })
})

describe('restoreCopy', () => {
  function error(fields: Partial<GimError> & Pick<GimError, 'kind'>): GimError {
    return { message: '', reason: '', ...fields } as GimError
  }

  it('maps each error kind to its copy', () => {
    expect(restoreCopy(error({ kind: 'InvalidInput', message: 'invalid input: bad user_id' })))
      .toEqual({ key: 'restore.invalidUserId' })
    expect(restoreCopy(error({ kind: 'InvalidInput', message: 'invalid input: bad recovery code' })))
      .toEqual({ key: 'restore.invalidRecoveryCode' })
    expect(restoreCopy(error({ kind: 'Crypto' }))).toEqual({ key: 'restore.wrongRecoveryCode' })
    expect(restoreCopy(error({ kind: 'NotFound' }))).toEqual({ key: 'restore.unknownUser' })
    expect(restoreCopy(error({ kind: 'RetryLater', status: 429, retryAfterSecs: 30 } as Partial<GimError> & Pick<GimError, 'kind'>)))
      .toEqual({
        key: 'errors.retryLater',
        values: { seconds: 30 },
      })
    expect(restoreCopy(error({ kind: 'Network' }))).toEqual({ key: 'errors.network' })
    expect(restoreCopy(error({ kind: 'UserNotAdmitted', hubId: 'h' } as Partial<GimError> & Pick<GimError, 'kind'>)))
      .toEqual({ key: 'restore.notAdmitted' })
    expect(restoreCopy(error({ kind: 'Storage' }))).toEqual({ key: 'common:errors.generic' })
    expect(restoreCopy(new Error('boom'))).toEqual({ key: 'common:errors.generic' })
  })
})
