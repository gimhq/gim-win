import { useTranslation } from 'react-i18next'
import { FLAGS } from '../flags'
import { SettingsRow } from '../ui'

/** C7: mute, pin and archive, hidden until `FLAGS.accountSafetyEntries`. */
export function ChatControlsEntry() {
  const { t } = useTranslation('settings')
  if (!FLAGS.accountSafetyEntries)
    return null
  return (
    <>
      <SettingsRow label={t('hidden.mute')} />
      <SettingsRow label={t('hidden.pin')} />
      <SettingsRow label={t('hidden.archive')} />
    </>
  )
}
