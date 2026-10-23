/**
 * The local full-text search index (client-side only; the hub has no
 * search); the Rust side is `src-tauri/src/search.rs`.
 */

import type { GimError } from './errors'
import { invoke } from '@tauri-apps/api/core'
import { isGimError } from './errors'

/** A message to (re-)index; an empty `body` removes it. Mirrors the Rust `IndexMessage`. */
export interface IndexMessage {
  chatId: string
  messageId: string
  senderName: string
  body: string
  sentAtMs: number
}

/** A chat name to (re-)index. Mirrors the Rust `IndexChat`. */
export interface IndexChat {
  chatId: string
  name: string
}

export interface ChatHit {
  chatId: string
  name: string
}

export interface MessageHit {
  chatId: string
  messageId: string
  senderName: string
  snippet: string
  sentAtMs: number
}

export interface SearchResults {
  chats: ChatHit[]
  messages: MessageHit[]
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

export function indexMessages(items: IndexMessage[]): Promise<void> {
  return call('index_messages', { items })
}

export function indexChats(chats: IndexChat[]): Promise<void> {
  return call('index_chats', { chats })
}

/** Removes the chat and all its messages from the index. */
export function removeChatFromIndex(chatId: string): Promise<void> {
  return call('remove_chat', { chatId })
}

/** Prefix search per word; `limit` is capped at 100; an empty query returns no results. */
export function search(query: string, limit: number): Promise<SearchResults> {
  return call('search', { query, limit })
}

/** Closes and deletes the index (sign-out). */
export function searchReset(): Promise<void> {
  return call('search_reset')
}
