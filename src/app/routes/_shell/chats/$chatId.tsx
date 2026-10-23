import { createFileRoute } from '@tanstack/react-router'
import { ChatPane } from '@/features/chats/timeline/chat-pane'

export const Route = createFileRoute('/_shell/chats/$chatId')({
  component: ChatPage,
})

function ChatPage() {
  const { chatId } = Route.useParams()
  return <ChatPane key={chatId} chatId={chatId} />
}
