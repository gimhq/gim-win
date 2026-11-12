import type { ChatSummary, IndexMessage, MessageContent, TimelineItem } from '@/lib/api'
import * as React from 'react'
import { i18n } from '@/i18n'
import { indexChats, indexMessages } from '@/lib/api'
import { chatTitle } from '../lib/chat-title'
import { chatListStore } from '../store'
import { timelineStore } from '../timeline/store'

const FLUSH_MS = 500

/** The indexed text of a message; empty for one without text, which drops it from the index. */
function indexBody(content: MessageContent): string {
  switch (content.type) {
    case 'Text':
      return content.body
    case 'Image':
      return content.caption ?? ''
    case 'File':
      return content.caption || content.fileName
    case 'Deleted':
    case 'Unsupported':
      return ''
  }
}

/**
 * Feeds the local search index from the chat list and timeline stores:
 * chat names as they are added or renamed, and every message seen, batched
 * into one `indexMessages` call per 500 ms. Returns the cleanup.
 */
export function startIndexFeed(): () => void {
  const chatNames = new Map<string, string>()
  // `${chatId}\n${messageId}` -> body already queued or sent
  const sentBodies = new Map<string, string>()
  const seenItems = new Map<string, TimelineItem[]>()
  let queue: IndexMessage[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  function syncChats(chats: ChatSummary[]): void {
    const changed = chats.filter(chat => chatNames.get(chat.chatId) !== chatTitle(chat, i18n.t))
    if (changed.length === 0)
      return
    for (const chat of changed)
      chatNames.set(chat.chatId, chatTitle(chat, i18n.t))
    indexChats(changed.map(chat => ({
      chatId: chat.chatId,
      name: chatTitle(chat, i18n.t),
    }))).catch((error: unknown) => {
      console.error('index_chats failed', error)
    })
  }

  function flush(): void {
    timer = null
    const items = queue
    queue = []
    indexMessages(items).catch((error: unknown) => {
      console.error('index_messages failed', error)
    })
  }

  function syncTimelines(byChat: Record<string, { items: TimelineItem[] }>): void {
    for (const [chatId, timeline] of Object.entries(byChat)) {
      if (seenItems.get(chatId) === timeline.items)
        continue
      seenItems.set(chatId, timeline.items)
      for (const entry of timeline.items) {
        if (entry.type !== 'Message')
          continue
        const message = entry.item
        const key = `${chatId}\n${message.messageId}`
        const body = indexBody(message.content)
        if (sentBodies.get(key) === body)
          continue
        sentBodies.set(key, body)
        queue.push({
          chatId,
          messageId: message.messageId,
          senderName: message.sender.displayName,
          body,
          sentAtMs: message.sentAtMs,
        })
      }
    }
    if (queue.length > 0 && timer === null)
      timer = setTimeout(flush, FLUSH_MS)
  }

  syncChats(chatListStore.getState().chats)
  syncTimelines(timelineStore.getState().byChat)
  const unsubscribes = [
    chatListStore.subscribe((state, previous) => {
      if (state.chats !== previous.chats)
        syncChats(state.chats)
    }),
    timelineStore.subscribe((state, previous) => {
      if (state.byChat !== previous.byChat)
        syncTimelines(state.byChat)
    }),
  ]
  return () => {
    unsubscribes.forEach(unsubscribe => unsubscribe())
    if (timer !== null)
      clearTimeout(timer)
  }
}

/** Runs the index feed while mounted; mount it once (the chats sidebar). */
export function useIndexFeed(): void {
  React.useEffect(() => startIndexFeed(), [])
}
