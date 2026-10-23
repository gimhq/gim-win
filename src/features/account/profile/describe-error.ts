import type { TFunction } from 'i18next'
import { isGimError } from '@/lib/api'

/** Copy for a failed profile command; `Server(409)` is left to the caller. */
export function describeError(t: TFunction, error: unknown): string {
  if (!isGimError(error))
    return t('common:errors.generic')
  switch (error.kind) {
    case 'Network':
      return t('common:errors.offline')
    case 'RetryLater':
      return t('account:errors.busy', { seconds: error.retryAfterSecs })
    default:
      return t('common:errors.generic')
  }
}
