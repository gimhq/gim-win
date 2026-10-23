/**
 * Chat list mirror for the system integration: the unread total and the
 * taskbar badge. The chats workstream (W3) exports the canonical chat list
 * store at src/features/chats/store.ts; this store is replaced by its
 * selector in the final integration task.
 */

import type { ChatSummary } from '@/lib/api'
import { create } from 'zustand'
import { setBadgeCount } from '@/features/settings/system-api'
import { applyDiffs, subscribeChatList } from '@/lib/api'

export interface UnreadState {
  chats: ChatSummary[]
  unreadTotal: number
  /** True once the first diff batch (the `Reset`) arrived. */
  loaded: boolean
  /** Subscribes to the chat list; resolves to the unsubscribe. */
  start: () => Promise<() => Promise<void>>
}

function sumUnread(chats: ChatSummary[]): number {
  return chats.reduce((total, chat) => chat.archived
    ? total
    : total + chat.unreadCount, 0)
}

export const useUnreadStore = create<UnreadState>()((set, get) => ({
  chats: [],
  unreadTotal: 0,
  loaded: false,

  start() {
    let first = true
    return subscribeChatList((diffs) => {
      const chats = applyDiffs(get().chats, diffs)
      const unreadTotal = sumUnread(chats)
      const changed = first || unreadTotal !== get().unreadTotal
      first = false
      set({ chats, unreadTotal, loaded: true })
      if (changed) {
        setBadgeCount(unreadTotal).catch((error: unknown) => {
          console.error('set_badge_count failed', error)
        })
      }
    })
  },
}))

export const selectUnreadTotal = (state: UnreadState) => state.unreadTotal
