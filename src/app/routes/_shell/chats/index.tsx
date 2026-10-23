import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useNewChatDialog } from '@/features/chats/hooks/use-new-chat-dialog'
import { useChatListStore } from '@/features/chats/store'

export const Route = createFileRoute('/_shell/chats/')({
  component: ChatsPage,
})

function ChatsPage() {
  const { t } = useTranslation('chat')
  const openNewChat = useNewChatDialog(state => state.setOpen)
  const isEmpty = useChatListStore(state => state.status === 'ready' && state.chats.length === 0)
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{t('titles.chats')}</h1>
      <p className="text-sm text-muted-foreground">{t('empty.selectChat')}</p>
      {isEmpty && <Button onClick={() => openNewChat(true)}>{t('list.startChat')}</Button>}
    </main>
  )
}
