import { openUrl } from '@tauri-apps/plugin-opener'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { selectNotifications, useSettingsStore } from '../store'
import { SettingsGroup, SettingsPage, SettingsRow } from '../ui'

const SYSTEM_SETTINGS_URL = 'ms-settings:notifications'

function isWindows(): boolean {
  return navigator.userAgent.includes('Windows')
}

export function NotificationsSection() {
  const { t } = useTranslation('settings')
  const notifications = useSettingsStore(selectNotifications)
  const update = useSettingsStore(state => state.update)
  const windows = isWindows()

  function openSystemSettings() {
    openUrl(SYSTEM_SETTINGS_URL).catch((error: unknown) => {
      console.error('opening the Windows notification settings failed', error)
    })
  }

  return (
    <SettingsPage title={t('titles.notifications')}>
      <SettingsGroup>
        <SettingsRow label={t('notifications.enabled')}>
          <Switch
            aria-label={t('notifications.enabled')}
            checked={notifications.enabled}
            onCheckedChange={enabled => void update({
              notifications: { enabled },
            })}
          />
        </SettingsRow>
        <SettingsRow label={t('notifications.sound')}>
          <Switch
            aria-label={t('notifications.sound')}
            checked={notifications.sound}
            disabled={!notifications.enabled}
            onCheckedChange={sound => void update({
              notifications: { sound },
            })}
          />
        </SettingsRow>
        <SettingsRow label={t('notifications.showText')} hint={t('notifications.showTextHint')}>
          <Switch
            aria-label={t('notifications.showText')}
            checked={notifications.showText}
            disabled={!notifications.enabled}
            onCheckedChange={showText => void update({
              notifications: { showText },
            })}
          />
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow label={t('notifications.openSystem')} hint={t('notifications.openSystemHint')}>
          <Button variant="outline" disabled={!windows} onClick={openSystemSettings}>
            {t('notifications.openSystem')}
          </Button>
        </SettingsRow>
      </SettingsGroup>
    </SettingsPage>
  )
}
