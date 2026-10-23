/**
 * Desktop integrations that are not GimClient commands: they go through
 * Tauri plugins instead of the bridge.
 */

import { writeText } from '@tauri-apps/plugin-clipboard-manager'

/** Puts `text` on the system clipboard. */
export function copyText(text: string): Promise<void> {
  return writeText(text)
}
