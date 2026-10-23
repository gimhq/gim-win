/**
 * Event subscriptions over the bridge streams. Each helper starts a stream
 * with its subscribe command, forwards the matching Tauri events to the
 * handler in arrival order and returns a function that ends the stream.
 * The first event carries the current value (a `Reset` for lists), as the
 * listeners of `docs/API.md` do.
 */

import type { ChatListDiff, ConnectionState, HubInfo, TimelineDiff, VectorDiff } from './types'
import { listen } from '@tauri-apps/api/event'
import * as commands from './commands'

export const EVENT_CHAT_LIST_DIFF = 'chat-list-diff'
export const EVENT_TIMELINE_DIFF = 'timeline-diff'
export const EVENT_CONNECTION_STATE = 'connection-state'
export const EVENT_TYPING = 'typing'
export const EVENT_HUB_LIST = 'hub-list'

export interface ChatListDiffEvent {
  subscriptionId: string
  diffs: ChatListDiff[]
}

export interface TimelineDiffEvent {
  subscriptionId: string
  chatId: string
  diffs: TimelineDiff[]
}

export interface ConnectionStateEvent {
  subscriptionId: string
  state: ConnectionState
}

export interface TypingEvent {
  subscriptionId: string
  chatId: string
  userIds: string[]
}

export interface HubListEvent {
  subscriptionId: string
  hubs: HubInfo[]
}

/** Ends the subscription: stops listening and invokes `unsubscribe`. */
export type Unsubscribe = () => Promise<void>

/**
 * Listens first, then starts the stream, so an event emitted before the
 * subscribe command returns is not lost: events arriving before the
 * subscription id is known are buffered and replayed (those of other
 * subscriptions are dropped).
 */
async function subscribe<P extends { subscriptionId: string }>(
  eventName: string,
  start: () => Promise<string>,
  onEvent: (payload: P) => void,
): Promise<Unsubscribe> {
  let subscriptionId: string | null = null
  const early: P[] = []
  const unlisten = await listen<P>(eventName, ({ payload }) => {
    if (subscriptionId === null)
      early.push(payload)
    else if (payload.subscriptionId === subscriptionId)
      onEvent(payload)
  })
  try {
    subscriptionId = await start()
  }
  catch (error) {
    unlisten()
    throw error
  }
  for (const payload of early.splice(0)) {
    if (payload.subscriptionId === subscriptionId)
      onEvent(payload)
  }
  const id = subscriptionId
  return async () => {
    unlisten()
    await commands.unsubscribe(id)
  }
}

/** Chat list diffs; the first batch is a `Reset`, pinned chats first, then most recently updated. */
export function subscribeChatList(onDiffs: (diffs: ChatListDiff[]) => void): Promise<Unsubscribe> {
  return subscribe<ChatListDiffEvent>(EVENT_CHAT_LIST_DIFF, commands.subscribeChatList, e => onDiffs(e.diffs))
}

/** Timeline diffs of one chat; the first batch is a `Reset` with the items loaded so far, oldest first. */
export function subscribeTimeline(chatId: string, onDiffs: (diffs: TimelineDiff[]) => void): Promise<Unsubscribe> {
  return subscribe<TimelineDiffEvent>(EVENT_TIMELINE_DIFF, () => commands.subscribeTimeline(chatId), e => onDiffs(e.diffs))
}

/** Connection state over the followed hubs; the first event is the current state. */
export function subscribeConnectionState(onChange: (state: ConnectionState) => void): Promise<Unsubscribe> {
  return subscribe<ConnectionStateEvent>(EVENT_CONNECTION_STATE, commands.subscribeConnectionState, e => onChange(e.state))
}

/** Typing user ids of one chat (other than the signed-in user); the first event is the current set. */
export function subscribeTyping(chatId: string, onUpdate: (userIds: string[]) => void): Promise<Unsubscribe> {
  return subscribe<TypingEvent>(EVENT_TYPING, () => commands.subscribeTyping(chatId), e => onUpdate(e.userIds))
}

/** Hub registry changes; the first event is the current `hubs()`. */
export function subscribeHubList(onUpdate: (hubs: HubInfo[]) => void): Promise<Unsubscribe> {
  return subscribe<HubListEvent>(EVENT_HUB_LIST, commands.subscribeHubList, e => onUpdate(e.hubs))
}

/**
 * Applies a diff batch to a list per `docs/API.md` "Diff semantics": diffs are
 * applied in order and indices refer to the list after the previous diff.
 * Returns a new array; `list` is not modified.
 */
export function applyDiffs<T>(list: readonly T[], diffs: VectorDiff<T>[]): T[] {
  let result = [...list]
  for (const diff of diffs) {
    switch (diff.type) {
      case 'Append':
        result.push(...diff.values)
        break
      case 'Clear':
        result = []
        break
      case 'PushFront':
        result.unshift(diff.value)
        break
      case 'PushBack':
        result.push(diff.value)
        break
      case 'PopFront':
        result.shift()
        break
      case 'PopBack':
        result.pop()
        break
      case 'Insert':
        result.splice(diff.index, 0, diff.value)
        break
      case 'Set':
        result[diff.index] = diff.value
        break
      case 'Remove':
        result.splice(diff.index, 1)
        break
      case 'Truncate':
        result.length = Math.min(result.length, diff.length)
        break
      case 'Reset':
        result = [...diff.values]
        break
    }
  }
  return result
}
