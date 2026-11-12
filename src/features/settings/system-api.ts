/**
 * Typed wrappers over the W4-1 system commands (settings persistence, badge,
 * notifications, window and tray). Same error contract as `src/lib/api`:
 * a rejection is a `GimError`, anything else is wrapped as `Internal`.
 */

import type { GimError } from '@/lib/api/errors'
import { invoke } from '@tauri-apps/api/core'
import { isGimError } from '@/lib/api/errors'

export type FontSize = 'small' | 'normal' | 'large' | 'extraLarge'

export interface NotificationSettings {
  enabled: boolean
  sound: boolean
  showText: boolean
}

export interface AppSettings {
  notifications: NotificationSettings
  fontSize: FontSize
  trayEnabled: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  notifications: { enabled: true, sound: true, showText: true },
  fontSize: 'normal',
  trayEnabled: true,
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args)
  }
  catch (error) {
    if (isGimError(error))
      throw error
    const internal: GimError = {
      kind: 'Internal',
      message: String(error),
      reason: String(error),
    }
    throw internal
  }
}

/** The persisted settings, or the defaults on first launch. */
export function loadSettings(): Promise<AppSettings> {
  return call('settings_load')
}

/** Persists the whole settings object. */
export function saveSettings(settings: AppSettings): Promise<void> {
  return call('settings_save', { settings })
}

/** Unread count on the taskbar icon; 0 clears it. */
export function setBadgeCount(count: number): Promise<void> {
  return call('set_badge_count', { count })
}

/** Shows an OS notification; clicking it opens `chatId`. */
export function notify(title: string, body: string, chatId: string): Promise<void> {
  return call('notify', { title, body, chatId })
}

export function showMainWindow(): Promise<void> {
  return call('show_main_window')
}

export function hideToTray(): Promise<void> {
  return call('hide_to_tray')
}

export function quitApp(): Promise<void> {
  return call('quit_app')
}

/** Localised labels of the tray menu items. */
export function setTrayLabels(labels: { show: string, hide: string, quit: string }): Promise<void> {
  return call('set_tray_labels', labels)
}

export type AuthOutcome = 'Verified' | 'Canceled' | 'Unavailable'

/**
 * Asks the user to prove they own this device (Windows Hello, else the
 * Windows password); `reason` is shown in the system prompt.
 */
export function authenticateDevice(reason: string): Promise<AuthOutcome> {
  return call('authenticate_device', { reason })
}

/** Keeps the window out of screenshots and screen capture while `enabled`. */
export function setCaptureProtection(enabled: boolean): Promise<void> {
  return call('set_capture_protection', { enabled })
}
