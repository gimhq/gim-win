import type { ChatListDiff, ChatSummary, GimError, Unsubscribe } from '@/lib/api'
import { create } from 'zustand'
import { applyDiffs, isGimError, subscribeChatList } from '@/lib/api'

export type ChatListStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ChatListState {
  /** Pinned chats first, then most recently updated, as the SDK orders them. */
  chats: ChatSummary[]
  /** `ready` from the first `Reset`. */
  status: ChatListStatus
  error: GimError | null
  applyChatListDiffs: (diffs: ChatListDiff[]) => void
  /** Back to the initial state; does not end the subscription. */
  reset: () => void
  /** Subscribes to the chat list; a no-op while a subscription is active. */
  start: () => Promise<void>
  /** Ends the subscription, if any. */
  stop: () => Promise<void>
}

/** A rejection as a `GimError`; anything else is wrapped as `Internal`. */
export function toGimError(error: unknown): GimError {
  if (isGimError(error))
    return error
  return {
    kind: 'Internal',
    message: String(error),
    reason: String(error),
  }
}

/** The active subscription; resolves to null when it failed to start. */
let subscription: Promise<Unsubscribe | null> | null = null

export const useChatListStore = create<ChatListState>()((set, get) => ({
  chats: [],
  status: 'idle',
  error: null,
  applyChatListDiffs: diffs => set(state => ({
    chats: applyDiffs(state.chats, diffs),
    ...(diffs.some(diff => diff.type === 'Reset')
      ? { status: 'ready', error: null }
      : {}),
  })),
  reset: () => set({ chats: [], status: 'idle', error: null }),
  start: async () => {
    if (subscription) {
      await subscription
      return
    }
    if (get().status !== 'ready')
      set({ status: 'loading', error: null })
    const pending = subscribeChatList(diffs => get().applyChatListDiffs(diffs)).catch((error: unknown) => {
      if (subscription === pending)
        subscription = null
      set({
        status: 'error',
        error: toGimError(error),
      })
      return null
    })
    subscription = pending
    await pending
  },
  stop: async () => {
    const pending = subscription
    subscription = null
    const unsubscribe = await pending
    await unsubscribe?.()
  },
}))

/** The vanilla store api, for code outside React (`getState`, `subscribe`). */
export const chatListStore = useChatListStore

let orderedSource: ChatSummary[] | null = null
let ordered: ChatSummary[] = []

/** List order: the note to self on top, then the SDK order; the same array while `chats` is unchanged. */
export function selectChats(state: ChatListState): ChatSummary[] {
  if (state.chats !== orderedSource) {
    orderedSource = state.chats
    const note = state.chats.find(chat => chat.isNoteToSelf)
    ordered = note
      ? [
          note,
          ...state.chats.filter(chat => chat !== note),
        ]
      : state.chats
  }
  return ordered
}

export function selectChat(chatId: string): (state: ChatListState) => ChatSummary | null {
  return state => state.chats.find(chat => chat.chatId === chatId) ?? null
}

/**
 * Unread messages over all chats that are neither archived nor `Left`. The
 * app badge and the tray (W4) subscribe to this selector through
 * `chatListStore.subscribe`.
 */
export function selectTotalUnread(state: ChatListState): number {
  let total = 0
  for (const chat of state.chats) {
    if (!chat.archived && chat.state !== 'Left')
      total += chat.unreadCount
  }
  return total
}

let idsSource: ChatSummary[] | null = null
let ids: string[] = []

/** Chat ids in list order; the same array while `chats` is unchanged. */
export function selectChatIds(state: ChatListState): string[] {
  const chats = selectChats(state)
  if (chats !== idsSource) {
    idsSource = chats
    ids = chats.map(chat => chat.chatId)
  }
  return ids
}
