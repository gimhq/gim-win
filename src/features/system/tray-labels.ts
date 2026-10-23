import type { i18n as I18n } from 'i18next'
import { setTrayLabels } from '@/features/settings/system-api'

/** Sends the tray menu labels in the UI language now and on every language change; returns the cleanup. */
export function syncTrayLabels(i18n: I18n): () => void {
  const apply = () => {
    const labels = {
      show: i18n.t('common:actions.show'),
      hide: i18n.t('common:actions.hide'),
      quit: i18n.t('common:actions.quit'),
    }
    setTrayLabels(labels).catch((error: unknown) => {
      console.error('set_tray_labels failed', error)
    })
  }
  apply()
  i18n.on('languageChanged', apply)
  return () => i18n.off('languageChanged', apply)
}
