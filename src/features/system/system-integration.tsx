import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSettingsStore } from '@/features/settings/store'
import { showMainWindow } from '@/features/settings/system-api'
import { i18n } from '@/i18n'
import { installShortcuts } from '@/lib/shortcuts'
import { installMessageNotifications } from './notifications'
import { installAppShortcuts } from './shortcuts'
import { ensureSyncStarted, markSyncStopped } from './sync'
import { syncTrayLabels } from './tray-labels'
import { useUnreadStore } from './unread-store'

/**
 * Desktop integration of the signed-in shell: sync, unread badge, message
 * notifications, app shortcuts and tray labels. Renders nothing.
 */
export function SystemIntegration() {
  const navigate = useNavigate()

  useEffect(() => {
    void ensureSyncStarted()
    // The bridge stops sync on sign out; a later sign-in remounts the shell and starts it again.
    return markSyncStopped
  }, [])

  useEffect(() => {
    void useSettingsStore.getState().load()
    let disposed = false
    let unsubscribe: (() => Promise<void>) | null = null
    useUnreadStore.getState().start().then((stop) => {
      if (disposed)
        void stop()
      else
        unsubscribe = stop
    }).catch((error: unknown) => {
      console.error('subscribe_chat_list failed', error)
    })
    return () => {
      disposed = true
      void unsubscribe?.()
    }
  }, [])

  useEffect(() => installMessageNotifications({
    onOpenChat: (chatId) => {
      showMainWindow()
        .catch((error: unknown) => {
          console.error('show_main_window failed', error)
        })
        .finally(() => {
          void navigate({
            to: '/chats/$chatId',
            params: { chatId },
          })
        })
    },
  }), [navigate])

  useEffect(() => {
    const cleanups = [
      installShortcuts(window),
      installAppShortcuts({
        openSettings: () => {
          void navigate({ to: '/settings' })
        },
      }),
      syncTrayLabels(i18n),
    ]
    return () => cleanups.forEach(cleanup => cleanup())
  }, [navigate])

  return null
}
