import { useTranslation } from 'react-i18next'
import { FLAGS } from '../flags'
import { SettingsRow } from '../ui'

/** C7: the blocked users entry, hidden until `FLAGS.accountSafetyEntries`. */
export function BlockedUsersEntry() {
  const { t } = useTranslation('settings')
  if (!FLAGS.accountSafetyEntries)
    return null
  return <SettingsRow label={t('hidden.blockedUsers')} />
}
