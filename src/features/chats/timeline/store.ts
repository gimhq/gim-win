import type { GimError, TimelineDiff, TimelineItem, Unsubscribe } from '@/lib/api'
import { create } from 'zustand'
import { applyDiffs, paginateBackwards, subscribeTimeline, subscribeTyping } from '@/lib/api'
import { toGimError } from '../store'

export type TimelineStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ChatTimeline {
  /** Oldest first. */
  items: TimelineItem[]
  /** `ready` from the first `Reset`. */
  status: TimelineStatus
  error: GimError | null
  /** Whether older history may exist; from the last `paginateBackwards`. */
  hasMore: boolean
  paginating: boolean
  /** User ids typing in the chat, other than the signed-in user. */
  typing: string[]
}

export interface TimelineState {
  byChat: Record<string, ChatTimeline>
  applyTimelineDiffs: (chatId: string, diffs: TimelineDiff[]) => void
  setTyping: (chatId: string, userIds: string[]) => void
  /** Subscribes to the chat's timeline and typing; a no-op while subscribed. */
  open: (chatId: string) => Promise<void>
  /** Ends both subscriptions; the items stay for a later `open`. */
  close: (chatId: string) => Promise<void>
  /** Loads up to `count` older items; resolves to `hasMore`. A no-op while a page is loading. */
  paginateBackwards: (chatId: string, count?: number) => Promise<boolean>
}

const EMPTY_TIMELINE: ChatTimeline = {
  items: [],
  status: 'idle',
  error: null,
  hasMore: true,
  paginating: false,
  typing: [],
}

/** Active subscriptions by chat id; resolve to null when they failed to start. */
const subscriptions = new Map<string, Promise<Unsubscribe[] | null>>()

async function unsubscribeAll(pending: Promise<Unsubscribe[] | null>): Promise<void> {
  const unsubscribes = await pending
  await Promise.all((unsubscribes ?? []).map(unsubscribe => unsubscribe()))
}

export const useTimelineStore = create<TimelineState>()((set, get) => {
  function update(chatId: string, change: (timeline: ChatTimeline) => Partial<ChatTimeline>): void {
    set((state) => {
      const timeline = state.byChat[chatId] ?? EMPTY_TIMELINE
      return {
        byChat: {
          ...state.byChat,
          [chatId]: {
            ...timeline,
            ...change(timeline),
          },
        },
      }
    })
  }

  async function subscribeBoth(chatId: string): Promise<Unsubscribe[]> {
    const results = await Promise.allSettled([
      subscribeTimeline(chatId, diffs => get().applyTimelineDiffs(chatId, diffs)),
      subscribeTyping(chatId, userIds => get().setTyping(chatId, userIds)),
    ])
    const started = results.flatMap(result => result.status === 'fulfilled'
      ? [result.value]
      : [])
    const failed = results.find(result => result.status === 'rejected')
    if (failed) {
      await Promise.all(started.map(unsubscribe => unsubscribe()))
      throw failed.reason
    }
    return started
  }

  return {
    byChat: {},
    applyTimelineDiffs: (chatId, diffs) => update(chatId, timeline => ({
      items: applyDiffs(timeline.items, diffs),
      ...(diffs.some(diff => diff.type === 'Reset')
        ? { status: 'ready', error: null }
        : {}),
    })),
    setTyping: (chatId, userIds) => update(chatId, () => ({ typing: userIds })),
    open: async (chatId) => {
      const active = subscriptions.get(chatId)
      if (active) {
        await active
        return
      }
      update(chatId, timeline => timeline.status === 'ready'
        ? {}
        : { status: 'loading', error: null })
      const pending: Promise<Unsubscribe[] | null> = subscribeBoth(chatId).catch((error: unknown) => {
        if (subscriptions.get(chatId) === pending)
          subscriptions.delete(chatId)
        update(chatId, () => ({
          status: 'error',
          error: toGimError(error),
        }))
        return null
      })
      subscriptions.set(chatId, pending)
      await pending
    },
    close: async (chatId) => {
      const pending = subscriptions.get(chatId)
      if (!pending)
        return
      subscriptions.delete(chatId)
      await unsubscribeAll(pending)
      if (get().byChat[chatId])
        update(chatId, () => ({ typing: [] }))
    },
    paginateBackwards: async (chatId, count = 50) => {
      const timeline = get().byChat[chatId] ?? EMPTY_TIMELINE
      if (timeline.paginating)
        return timeline.hasMore
      update(chatId, () => ({ paginating: true }))
      try {
        const hasMore = await paginateBackwards(chatId, count)
        update(chatId, () => ({ hasMore, paginating: false }))
        return hasMore
      }
      catch (error) {
        update(chatId, () => ({ paginating: false }))
        throw error
      }
    },
  }
})

/** The vanilla store api, for code outside React (`getState`, `subscribe`). */
export const timelineStore = useTimelineStore

const EMPTY_ITEMS: TimelineItem[] = []
const EMPTY_TYPING: string[] = []

export function selectTimeline(chatId: string): (state: TimelineState) => ChatTimeline | null {
  return state => state.byChat[chatId] ?? null
}

/** The chat's items; one shared empty array while the chat is unknown. */
export function selectItems(chatId: string): (state: TimelineState) => TimelineItem[] {
  return state => state.byChat[chatId]?.items ?? EMPTY_ITEMS
}

/** The index of the message in the chat's items, or -1. */
export function selectMessageIndex(chatId: string, messageId: string): (state: TimelineState) => number {
  return state => (state.byChat[chatId]?.items ?? EMPTY_ITEMS)
    .findIndex(entry => entry.type === 'Message' && entry.item.messageId === messageId)
}

export function selectTyping(chatId: string): (state: TimelineState) => string[] {
  return state => state.byChat[chatId]?.typing ?? EMPTY_TYPING
}
