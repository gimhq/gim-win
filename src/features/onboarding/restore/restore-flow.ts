/**
 * The pure parts of "Restore with your recovery kit": filling the two
 * fallback fields from a parsed kit, the status line under the pasted kit,
 * the submit payload and the error copy.
 */

import type { Copy } from '../create/create-flow'
import type { ParsedRecoveryKit } from '@/lib/api'
import { isGimError } from '@/lib/api'

/** The two fallback fields the user can edit. */
export interface RestoreFields {
  userId: string
  recoveryCode: string
}

/** Overwrites each field the kit provided; keeps what the user typed otherwise. */
export function fillFields(fields: RestoreFields, parsed: ParsedRecoveryKit): RestoreFields {
  return {
    userId: parsed.userId ?? fields.userId,
    recoveryCode: parsed.recoveryCode ?? fields.recoveryCode,
  }
}

export type KitStatus = 'restore.kitFound' | 'restore.kitNotRecognized' | 'restore.kitIncomplete'

/** The status line key for the pasted text, or `null` while nothing is pasted. */
export function kitStatus(text: string, parsed: ParsedRecoveryKit): KitStatus | null {
  if (text.trim() === '')
    return null
  if (parsed.userId !== null && parsed.recoveryCode !== null)
    return 'restore.kitFound'
  if (parsed.userId === null && parsed.recoveryCode === null)
    return 'restore.kitNotRecognized'
  return 'restore.kitIncomplete'
}

/** The fields as one text for `parseRecoveryKit`, which normalises both values. */
export function normalizeText(fields: RestoreFields): string {
  return `${fields.userId}\n${fields.recoveryCode}`
}

/** The parsed values when found, else the raw field so the SDK reports `InvalidInput`. */
export function restorePayload(fields: RestoreFields, parsed: ParsedRecoveryKit): RestoreFields {
  return {
    userId: parsed.userId ?? fields.userId.trim(),
    recoveryCode: parsed.recoveryCode ?? fields.recoveryCode.trim(),
  }
}

export function restoreCopy(error: unknown): Copy {
  if (!isGimError(error))
    return { key: 'common:errors.generic' }
  switch (error.kind) {
    case 'InvalidInput':
      return error.message.includes('user_id')
        ? { key: 'restore.invalidUserId' }
        : { key: 'restore.invalidRecoveryCode' }
    case 'Crypto':
      return { key: 'restore.wrongRecoveryCode' }
    case 'NotFound':
      return { key: 'restore.unknownUser' }
    case 'RetryLater':
      return {
        key: 'errors.retryLater',
        values: { seconds: error.retryAfterSecs },
      }
    case 'Network':
      return { key: 'errors.network' }
    case 'UserNotAdmitted':
      return { key: 'restore.notAdmitted' }
    default:
      return { key: 'common:errors.generic' }
  }
}
