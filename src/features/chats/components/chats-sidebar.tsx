import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { SearchIcon, SquarePenIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { session } from '@/lib/api'
import { popScope, pushScope, register } from '@/lib/shortcuts'
import { CHAT_SCOPE, useChatShortcuts } from '../hooks/use-chat-shortcuts'
import { useNewChatDialog } from '../hooks/use-new-chat-dialog'
import { SearchPalette } from '../search/search-palette'
import { useIndexFeed } from '../search/use-index-feed'
import { useSearchPalette } from '../search/use-search-palette'
import { ChatAvatar } from './chat-avatar'
import { ChatList } from './chat-list'
import { NewChatDialog } from './new-chat-dialog'

/** The sidebar of the shell: header with the account, New chat and `actions`, then the chat list. */
export function ChatsSidebar({ actions }: { actions?: ReactNode }) {
  const { t } = useTranslation('chat')
  const openNewChat = useNewChatDialog(state => state.setOpen)
  const openSearch = useSearchPalette(state => state.setOpen)
  const { data: account } = useQuery({
    queryKey: ['session'],
    queryFn: session,
  })

  React.useEffect(() => {
    pushScope(CHAT_SCOPE)
    return () => popScope(CHAT_SCOPE)
  }, [])
  useChatShortcuts()
  React.useEffect(() => register(CHAT_SCOPE, 'Mod+K', () => openSearch(true)), [openSearch])
  useIndexFeed()

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <Link
          to="/settings/profile"
          aria-label={t('list.settings')}
          title={t('list.settings')}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChatAvatar name={account?.displayName ?? ''} colorKey={account?.userId ?? ''} />
        </Link>
        <Link to="/chats" className="flex-1 truncate text-base font-semibold tracking-tight">
          {t('common:appName')}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('search.title')}
          title={t('shortcuts.search')}
          onClick={() => openSearch(true)}
        >
          <SearchIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('list.newChat')}
          title={t('shortcuts.newChat')}
          onClick={() => openNewChat(true)}
        >
          <SquarePenIcon />
        </Button>
        {actions}
      </header>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <ChatList onNewChat={() => openNewChat(true)} />
      </div>
      <NewChatDialog />
      <SearchPalette />
    </>
  )
}
