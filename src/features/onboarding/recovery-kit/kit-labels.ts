import type { RecoveryKitLabels } from '@/lib/api'

export const KIT_FILE_NAME = 'gim-recovery-kit.txt'

/** The recovery code in groups of four, for display only. */
export function groupCode(recoveryCode: string): string {
  return recoveryCode.replace(/[\s-]/g, '').match(/.{1,4}/g)?.join('-') ?? ''
}

/** The kit text's words in the current language, from the onboarding namespace. */
export function kitLabels(t: (key: string) => string): RecoveryKitLabels {
  return {
    title: t('kit.file.title'),
    accountId: t('kit.file.accountId'),
    recoveryKey: t('kit.file.recoveryKey'),
    note: t('kit.file.note'),
  }
}
