import type { AppSettings, FontSize } from './system-api'
import { create } from 'zustand'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './system-api'

export { type AppSettings, DEFAULT_SETTINGS, type FontSize } from './system-api'

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export interface SettingsState {
  settings: AppSettings
  loaded: boolean
  /** Loads the persisted settings once; a failure keeps the defaults. */
  load: () => Promise<void>
  /** Applies the patch at once and persists the merged object. */
  update: (patch: DeepPartial<AppSettings> | ((settings: AppSettings) => AppSettings)) => Promise<void>
}

const FONT_SIZE_PX: Record<FontSize, string> = {
  small: '14px',
  normal: '16px',
  large: '18px',
  extraLarge: '20px',
}

/** Sets `--app-font-size` (14/16/18/20px) on the root element for the stylesheet to read. */
export function applyFontSize(fontSize: FontSize): void {
  document.documentElement.style.setProperty('--app-font-size', FONT_SIZE_PX[fontSize])
}

function merge(settings: AppSettings, patch: DeepPartial<AppSettings>): AppSettings {
  return {
    ...settings,
    ...patch,
    notifications: {
      ...settings.notifications,
      ...patch.notifications,
    },
  }
}

let loading: Promise<void> | null = null

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load() {
    if (get().loaded)
      return Promise.resolve()
    loading ??= loadSettings()
      .then((loaded) => {
        // A missing or partial object (a bridge mock, an older file) keeps the defaults.
        const settings = merge(DEFAULT_SETTINGS, loaded ?? {})
        set({ settings, loaded: true })
        applyFontSize(settings.fontSize)
      })
      .catch((error: unknown) => {
        console.error('settings_load failed, keeping defaults', error)
        set({ loaded: true })
        applyFontSize(get().settings.fontSize)
      })
      .finally(() => {
        loading = null
      })
    return loading
  },

  async update(patch) {
    const current = get().settings
    const next = typeof patch === 'function'
      ? patch(current)
      : merge(current, patch)
    set({ settings: next })
    if (next.fontSize !== current.fontSize)
      applyFontSize(next.fontSize)
    try {
      await saveSettings(next)
    }
    catch (error) {
      console.error('settings_save failed, keeping the unsaved value', error)
    }
  },
}))

export const selectNotifications = (state: SettingsState) => state.settings.notifications
export const selectFontSize = (state: SettingsState) => state.settings.fontSize
export const selectTrayEnabled = (state: SettingsState) => state.settings.trayEnabled
