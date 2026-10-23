import { useTranslation } from 'react-i18next'
import { FLAGS } from '../flags'
import { SettingsRow } from '../ui'

/** C7: the typing indicators switch, hidden until `FLAGS.accountSafetyEntries`. */
export function TypingIndicatorsSwitch() {
  const { t } = useTranslation('settings')
  if (!FLAGS.accountSafetyEntries)
    return null
  return <SettingsRow label={t('hidden.typingIndicators')} />
}
