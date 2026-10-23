import type { ChatHit, MessageHit } from '@/lib/api'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { cn } from 'cn'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { search } from '@/lib/api'
import { formatChatListTime } from '@/lib/format'
import { popScope, pushScope, register } from '@/lib/shortcuts'
import { ChatAvatar } from '../components/chat-avatar'
import { useDebouncedQuery } from './use-debounced-query'
import { useSearchPalette } from './use-search-palette'

const LIMIT = 30
const SEARCH_SCOPE = 'search'

type Entry = { kind: 'chat', hit: ChatHit } | { kind: 'message', hit: MessageHit }

/** Search over the local index: chats, then messages; arrows move, Enter opens. */
export function SearchPalette() {
  const { t } = useTranslation('chat')
  const open = useSearchPalette(state => state.open)
  const setOpen = useSearchPalette(state => state.setOpen)
  const navigate = useNavigate()
  const [query, setQuery] = React.useState('')
  const [selected, setSelected] = React.useState(0)
  const debounced = useDebouncedQuery(query)

  const { data } = useQuery({
    queryKey: ['search', debounced, LIMIT],
    queryFn: () => search(debounced, LIMIT),
    enabled: open && debounced !== '',
    placeholderData: keepPreviousData,
  })
  const results = debounced === ''
    ? null
    : data ?? null
  const entries = React.useMemo<Entry[]>(() => results
    ? [
        ...results.chats.map(hit => ({ kind: 'chat', hit }) as const),
        ...results.messages.map(hit => ({ kind: 'message', hit }) as const),
      ]
    : [], [results])

  // New results select the first entry.
  const [shownEntries, setShownEntries] = React.useState(entries)
  if (shownEntries !== entries) {
    setShownEntries(entries)
    setSelected(0)
  }

  React.useEffect(() => {
    if (!open)
      return
    pushScope(SEARCH_SCOPE)
    const unregister = register(SEARCH_SCOPE, 'Escape', () => setOpen(false))
    return () => {
      unregister()
      popScope(SEARCH_SCOPE)
    }
  }, [open, setOpen])

  function onOpenChange(next: boolean): void {
    setOpen(next)
    if (!next)
      setQuery('')
  }

  function choose(entry: Entry): void {
    onOpenChange(false)
    void navigate(entry.kind === 'chat'
      ? {
          to: '/chats/$chatId',
          params: { chatId: entry.hit.chatId },
        }
      : {
          to: '/chats/$chatId',
          params: { chatId: entry.hit.chatId },
          search: { message: entry.hit.messageId },
        })
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    if (entries.length === 0)
      return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown'
        ? 1
        : -1
      setSelected(index => (index + delta + entries.length) % entries.length)
    }
    else if (event.key === 'Enter') {
      event.preventDefault()
      const entry = entries[selected]
      if (entry)
        choose(entry)
    }
  }

  function renderEntry(entry: Entry, index: number): React.ReactNode {
    const isSelected = index === selected
    return (
      <div
        key={entry.kind === 'chat'
          ? `chat-${entry.hit.chatId}`
          : `message-${entry.hit.chatId}-${entry.hit.messageId}`}
        role="option"
        aria-selected={isSelected}
        className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5', isSelected && 'bg-accent text-accent-foreground')}
        onMouseEnter={() => setSelected(index)}
        onClick={() => choose(entry)}
      >
        {entry.kind === 'chat'
          ? (
              <>
                <ChatAvatar name={entry.hit.name} colorKey={entry.hit.chatId} size="sm" />
                <span className="truncate text-sm">{entry.hit.name}</span>
              </>
            )
          : (
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate font-medium">{entry.hit.senderName}</span>
                  <span className="ml-auto shrink-0">{formatChatListTime(entry.hit.sentAtMs)}</span>
                </span>
                <span className="truncate text-sm">{entry.hit.snippet}</span>
              </span>
            )}
      </div>
    )
  }

  const chatCount = results?.chats.length ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('search.title')}</DialogTitle>
        <Input
          autoFocus
          value={query}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {results && (
          entries.length === 0
            ? <p className="py-6 text-center text-sm text-muted-foreground">{t('search.noResults')}</p>
            : (
                <div role="listbox" aria-label={t('search.title')} className="flex max-h-96 flex-col gap-1 overflow-y-auto">
                  {chatCount > 0 && <p className="px-2 pt-1 text-xs font-medium text-muted-foreground">{t('search.chats')}</p>}
                  {entries.slice(0, chatCount).map((entry, index) => renderEntry(entry, index))}
                  {entries.length > chatCount && <p className="px-2 pt-1 text-xs font-medium text-muted-foreground">{t('search.messages')}</p>}
                  {entries.slice(chatCount).map((entry, index) => renderEntry(entry, chatCount + index))}
                </div>
              )
        )}
        <p className="text-xs text-muted-foreground">{t('search.onlySeenNote')}</p>
      </DialogContent>
    </Dialog>
  )
}
