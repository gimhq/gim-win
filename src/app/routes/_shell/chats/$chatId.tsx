import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Composer } from '@/features/chats/composer/composer'
import { useFileDrop } from '@/features/chats/composer/use-attachments'
import { useJumpRequest } from '@/features/chats/search/jump'
import { ChatPane } from '@/features/chats/timeline/chat-pane'
import { MembersButton } from '@/features/chats/timeline/members-sheet'
import { useChatState } from '@/features/chats/timeline/use-chat-state'

interface ChatSearch {
  /** A message to scroll to (from search); cleared once requested. */
  message?: string
}

export const Route = createFileRoute('/_shell/chats/$chatId')({
  validateSearch: (search: Record<string, unknown>): ChatSearch => typeof search.message === 'string'
    ? { message: search.message }
    : {},
  component: ChatPage,
})

function ChatPage() {
  const { chatId } = Route.useParams()
  return <Chat key={chatId} chatId={chatId} />
}

/** The pane with the composer and header actions; files dropped on it become attachments while the chat is active. */
function Chat({ chatId }: { chatId: string }) {
  const { t } = useTranslation('chat')
  const dragging = useFileDrop(useChatState(chatId) === 'Active')
  const { message } = Route.useSearch()
  const navigate = Route.useNavigate()

  React.useEffect(() => {
    if (message === undefined)
      return
    useJumpRequest.getState().requestJump(chatId, message)
    void navigate({ search: {}, replace: true })
  }, [chatId, message, navigate])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ChatPane chatId={chatId} actions={<MembersButton chatId={chatId} />} composer={<Composer chatId={chatId} />} />
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center border-2 border-dashed border-primary bg-background/80 text-sm font-medium text-primary">
          {t('composer.dropHere')}
        </div>
      )}
    </div>
  )
}
