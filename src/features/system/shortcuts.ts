import { hideToTray, quitApp } from '@/features/settings/system-api'
import { GLOBAL_SCOPE, register } from '@/lib/shortcuts'

export interface AppShortcutActions {
  openSettings: () => void
}

function logFailure(command: string) {
  return (error: unknown) => {
    console.error(`${command} failed`, error)
  }
}

/**
 * Global app shortcuts: Mod+, settings, Mod+Q quit, Mod+W hide. Whether
 * Mod+W hides to the tray or quits is decided by the Rust side from the
 * tray setting. Returns the combined unregister.
 */
export function installAppShortcuts({ openSettings }: AppShortcutActions): () => void {
  const unregister = [
    register(GLOBAL_SCOPE, 'Mod+,', () => {
      openSettings()
    }),
    register(GLOBAL_SCOPE, 'Mod+Q', () => {
      quitApp().catch(logFailure('quit_app'))
    }),
    register(GLOBAL_SCOPE, 'Mod+W', () => {
      hideToTray().catch(logFailure('hide_to_tray'))
    }),
  ]
  return () => unregister.forEach(fn => fn())
}
