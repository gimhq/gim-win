/**
 * Attachment bytes without a file (pasted images) are staged to a file under
 * the app cache; the Rust side is `src-tauri/src/staging.rs`.
 */

import type { GimError } from './errors'
import { invoke } from '@tauri-apps/api/core'
import { isGimError } from './errors'

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

/** Writes `bytes` to a new file named `<random>.<extension>` and returns its path; `InvalidInput` for a bad extension or over 100 MiB. */
export function stageAttachment(bytes: Uint8Array, extension: string): Promise<string> {
  return call('stage_attachment', {
    bytes: Array.from(bytes),
    extension,
  })
}
