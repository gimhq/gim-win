import { useRouter } from '@tanstack/react-router'
import * as React from 'react'
import { register } from '@/lib/shortcuts'
import { chatListStore, selectChatIds } from '../store'
import { useNewChatDialog } from './use-new-chat-dialog'

export const CHAT_SCOPE = 'chat'

/**
 * Chat list shortcuts in the `chat` scope: Mod+N opens New chat,
 * Ctrl+ArrowUp / Ctrl+ArrowDown open the previous / next chat in list order
 * (the first one when no chat is open; nothing at the ends).
 */
export function useChatShortcuts(): void {
  const router = useRouter()

  React.useEffect(() => {
    function step(delta: -1 | 1): void {
      const ids = selectChatIds(chatListStore.getState())
      const current = router.state.matches.find(match => match.routeId === '/_shell/chats/$chatId')
      const currentId = (current?.params as { chatId?: string } | undefined)?.chatId
      const index = currentId === undefined
        ? -1
        : ids.indexOf(currentId)
      const next = index === -1
        ? ids[0]
        : ids[index + delta]
      if (next !== undefined && next !== currentId) {
        void router.navigate({
          to: '/chats/$chatId',
          params: { chatId: next },
        })
      }
    }

    const cleanups = [
      register(CHAT_SCOPE, 'Mod+N', () => useNewChatDialog.getState().setOpen(true)),
      register(CHAT_SCOPE, 'Ctrl+ArrowUp', () => step(-1)),
      register(CHAT_SCOPE, 'Ctrl+ArrowDown', () => step(1)),
    ]
    return () => cleanups.forEach(cleanup => cleanup())
  }, [router])
}
