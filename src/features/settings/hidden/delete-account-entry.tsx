import { useTranslation } from 'react-i18next'
import { FLAGS } from '../flags'
import { SettingsRow } from '../ui'

/** C7: the delete account entry, hidden until `FLAGS.accountSafetyEntries`. */
export function DeleteAccountEntry() {
  const { t } = useTranslation('settings')
  if (!FLAGS.accountSafetyEntries)
    return null
  return <SettingsRow label={t('hidden.deleteAccount')} className="text-destructive" />
}
