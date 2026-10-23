import type { ChatState } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { chatState } from '@/lib/api'
import { selectChat, useChatListStore } from '../store'

/** The chat's state from the list, or from the api while the chat is not listed yet; null while unknown. */
export function useChatState(chatId: string): ChatState | null {
  const listed = useChatListStore(state => selectChat(chatId)(state)?.state ?? null)
  const listReady = useChatListStore(state => state.status === 'ready')
  const fallback = useQuery({
    queryKey: ['chatState', chatId],
    queryFn: () => chatState(chatId),
    enabled: listed === null && !listReady,
  })
  return listed ?? fallback.data ?? null
}
