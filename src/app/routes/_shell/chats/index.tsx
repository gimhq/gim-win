import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_shell/chats/')({
  component: ChatsPage,
})

function ChatsPage() {
  const { t } = useTranslation('chat')
  return <PlaceholderPage title={t('titles.chats')} description={t('empty.selectChat')} />
}
