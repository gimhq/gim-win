import type { TFunction } from 'i18next'
import { isGimError } from '@/lib/api'

/** Copy for a failed device or recovery-key command. */
export function describeError(t: TFunction, error: unknown): string {
  if (!isGimError(error))
    return t('common:errors.generic')
  switch (error.kind) {
    case 'Network':
      return t('account:devices.errors.offline')
    case 'RetryLater':
      return t('account:errors.busy', { seconds: error.retryAfterSecs })
    default:
      return t('common:errors.generic')
  }
}
