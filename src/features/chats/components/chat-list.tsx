import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { selectChats, useChatListStore } from '../store'
import { ChatRow } from './chat-row'

const SKELETON_ROWS = 6

/** The chat list of the sidebar, in store order. */
export function ChatList({ onNewChat }: { onNewChat: () => void }) {
  const { t } = useTranslation('chat')
  const chats = useChatListStore(selectChats)
  const status = useChatListStore(state => state.status)

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex flex-col gap-1 p-2" aria-busy="true">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2" data-testid="chat-row-skeleton">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (chats.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {status === 'error'
            ? t('errors.generic')
            : t('empty.noChats')}
        </p>
        {status === 'ready' && <Button onClick={onNewChat}>{t('list.startChat')}</Button>}
      </div>
    )
  }

  return (
    <nav aria-label={t('titles.chats')} className="flex flex-col gap-0.5 p-2">
      {chats.map(chat => <ChatRow key={chat.chatId} chat={chat} />)}
    </nav>
  )
}
