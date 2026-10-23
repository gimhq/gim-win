/**
 * Typed wrappers over the recovery kit commands (API.md "Recovery kit") and
 * the desktop save dialog. Same shape as `./commands`: a rejection is a
 * `GimError`; anything else is wrapped as `Internal`.
 */

import type { GimError } from './errors'
import { invoke } from '@tauri-apps/api/core'
import { isGimError } from './errors'

/** The app's localized words of the kit text. */
export interface RecoveryKitLabels {
  title: string
  accountId: string
  recoveryKey: string
  note: string
}

/** What `parseRecoveryKit` found: the user id and the code without separators, each if present. */
export interface ParsedRecoveryKit {
  userId: string | null
  recoveryCode: string | null
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

/** The kit text: title, account id line, recovery key line, a blank line and the note. */
export function formatRecoveryKit(userId: string, recoveryCode: string, labels: RecoveryKitLabels): Promise<string> {
  return call('format_recovery_kit', { userId, recoveryCode, labels })
}

/** Finds the user id and the recovery code in pasted text, whatever the labels' language. */
export function parseRecoveryKit(text: string): Promise<ParsedRecoveryKit> {
  return call('parse_recovery_kit', { text })
}

/** The last four symbols of the recovery code. */
export function recoveryKeyEnding(recoveryCode: string): Promise<string> {
  return call('recovery_key_ending', { recoveryCode })
}

/** Whether `typed` is the code's last four symbols (case, `-` and spaces ignored). */
export function matchesRecoveryKeyEnding(recoveryCode: string, typed: string): Promise<boolean> {
  return call('matches_recovery_key_ending', { recoveryCode, typed })
}

/** Opens the native save dialog and writes `contents`; the chosen path, or `null` when cancelled. */
export function saveTextFile(defaultName: string, contents: string): Promise<string | null> {
  return call('save_text_file', { defaultName, contents })
}
