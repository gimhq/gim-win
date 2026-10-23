import type { RecoveryKitLabels } from '@/lib/api'

/** The kit text's words in the current language, from the onboarding namespace. */
export function kitLabels(t: (key: string) => string): RecoveryKitLabels {
  return {
    title: t('kit.file.title'),
    accountId: t('kit.file.accountId'),
    recoveryKey: t('kit.file.recoveryKey'),
    note: t('kit.file.note'),
  }
}
