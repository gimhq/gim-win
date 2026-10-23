/**
 * Link previews fetched by the app itself (never through the hub); the
 * Rust side is `src-tauri/src/preview.rs`.
 */

import type { GimError } from './errors'
import { invoke } from '@tauri-apps/api/core'
import { isGimError } from './errors'

/** The metadata of a linked page; mirrors the Rust `LinkPreview`. */
export interface LinkPreview {
  url: string
  finalUrl: string
  title: string | null
  description: string | null
  imageUrl: string | null
  siteName: string | null
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

/** `null` if the URL is invalid or private, the fetch failed or the page has nothing to show. */
export function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  return call('fetch_link_preview', { url })
}
