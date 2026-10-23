import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronUpIcon, XIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { search } from '@/lib/api'
import { register } from '@/lib/shortcuts'
import { CHAT_SCOPE } from '../hooks/use-chat-shortcuts'
import { useDebouncedQuery } from './use-debounced-query'

const LIMIT = 100

interface InChatSearchProps {
  chatId: string
  /** Scrolls to and highlights the message. */
  onJump: (messageId: string) => void
}

/** Mod+F: a find bar over the chat's messages in the local index, stepping from the newest hit. */
export function InChatSearch({ chatId, onJump }: InChatSearchProps) {
  const { t } = useTranslation('chat')
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [current, setCurrent] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounced = useDebouncedQuery(query)

  const { data } = useQuery({
    queryKey: ['search', debounced, LIMIT],
    queryFn: () => search(debounced, LIMIT),
    enabled: open && debounced !== '',
    placeholderData: keepPreviousData,
  })
  const hits = React.useMemo(() => (debounced === ''
    ? []
    : data?.messages ?? [])
    .filter(hit => hit.chatId === chatId)
    .sort((a, b) => a.sentAtMs - b.sentAtMs), [chatId, data, debounced])

  React.useEffect(() => register(CHAT_SCOPE, 'Mod+F', () => {
    setOpen(true)
    inputRef.current?.select()
  }), [])

  const close = React.useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  React.useEffect(() => {
    if (!open)
      return
    return register(CHAT_SCOPE, 'Escape', close)
  }, [close, open])

  // New results start at the newest hit.
  const [shownHits, setShownHits] = React.useState(hits)
  if (shownHits !== hits) {
    setShownHits(hits)
    setCurrent(Math.max(0, hits.length - 1))
  }
  React.useEffect(() => {
    const newest = hits.at(-1)
    if (newest)
      onJump(newest.messageId)
  }, [hits, onJump])

  function step(delta: -1 | 1): void {
    if (hits.length === 0)
      return
    const next = (current + delta + hits.length) % hits.length
    setCurrent(next)
    onJump(hits[next]!.messageId)
  }

  if (!open)
    return null

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 py-1.5">
      <Input
        ref={inputRef}
        autoFocus
        value={query}
        placeholder={t('search.inChatPlaceholder')}
        aria-label={t('search.inChatPlaceholder')}
        className="h-7 flex-1"
        onChange={event => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            step(event.shiftKey
              ? -1
              : 1)
          }
        }}
      />
      {hits.length > 0 && (
        <span className="shrink-0 px-1 text-xs text-muted-foreground tabular-nums">
          {t('search.count', { current: current + 1, total: hits.length })}
        </span>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={t('search.previous')} title={t('search.previous')} disabled={hits.length === 0} onClick={() => step(-1)}>
        <ChevronUpIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t('search.next')} title={t('search.next')} disabled={hits.length === 0} onClick={() => step(1)}>
        <ChevronDownIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t('search.close')} title={t('search.close')} onClick={close}>
        <XIcon />
      </Button>
    </div>
  )
}
