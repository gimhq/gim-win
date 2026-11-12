import type { TFunction } from 'i18next'
import type { ChatSummary } from '@/lib/api'

/** The name a chat is shown under: "Note to self" for the chat with yourself. */
export function chatTitle(chat: Pick<ChatSummary, 'name' | 'isNoteToSelf'>, t: TFunction): string {
  return chat.isNoteToSelf
    ? t('chat:noteToSelf.title')
    : chat.name
}
