import type { Row } from '../lib/grouping'
import type { NameOf } from './use-members'
import { useVirtualizer } from '@tanstack/react-virtual'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { groupTimeline } from '../lib/grouping'
import { InChatSearch } from '../search/in-chat-search'
import { useJumpRequest } from '../search/jump'
import { DateSeparator } from './date-separator'
import { JumpToLatest } from './jump-to-latest'
import { MembershipRow } from './membership-row'
import { MessageBubble } from './message-bubble'
import { selectItems, selectMessageIndex, selectTimeline, timelineStore, useTimelineStore } from './store'

const PAGE_SIZE = 50
/** Within this distance of the bottom, appended rows keep the view at the bottom. */
const BOTTOM_THRESHOLD_PX = 80
/** Older history loads while the first rendered row is above this index. */
const PAGINATE_ROW_THRESHOLD = 20
/** Height of the history status line above the rows. */
const HISTORY_LINE_PX = 32
const HIGHLIGHT_MS = 1500
const JUMP_MAX_PAGES = 5
/** A search hit may be further back than a quoted reply. */
const SEARCH_JUMP_MAX_PAGES = 10

function rowKey(row: Row): string {
  switch (row.kind) {
    case 'message':
      return row.item.messageId
    case 'date':
      return `date-${row.dayStartMs}`
    case 'membership':
      return `membership-${row.userId}-${row.change}-${row.atMs}`
  }
}

function paginate(chatId: string): Promise<boolean> {
  return timelineStore.getState().paginateBackwards(chatId, PAGE_SIZE)
}

/** Resolves once no older page of the chat is loading. */
function pageIdle(chatId: string): Promise<void> {
  const idle = () => !timelineStore.getState().byChat[chatId]?.paginating
  return new Promise((resolve) => {
    if (idle()) {
      resolve()
      return
    }
    const unsubscribe = timelineStore.subscribe(() => {
      if (idle()) {
        unsubscribe()
        resolve()
      }
    })
  })
}

interface MessageListProps {
  chatId: string
  isGroup: boolean
  nameOf: NameOf
}

/** The chat's timeline as a virtualised, bottom-anchored list that loads older history at the top. */
export function MessageList({ chatId, isGroup, nameOf }: MessageListProps) {
  const { t } = useTranslation('chat')
  const timeline = useTimelineStore(selectTimeline(chatId))
  const items = useTimelineStore(selectItems(chatId))
  const rows = React.useMemo(() => groupTimeline(items), [items])
  const ready = timeline?.status === 'ready'
  const hasMore = timeline?.hasMore ?? true
  const paginating = timeline?.paginating ?? false

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    getItemKey: index => rowKey(rows[index]!),
    overscan: 10,
    paddingStart: HISTORY_LINE_PX,
  })
  const virtualItems = virtualizer.getVirtualItems()

  const atBottomRef = React.useRef(true)
  const [atBottom, setAtBottom] = React.useState(true)
  const [nearTop, setNearTop] = React.useState(false)
  const [unseen, setUnseen] = React.useState(0)
  const [pageFailed, setPageFailed] = React.useState(false)
  // `seq` makes a repeated jump to the same message scroll again.
  const [highlight, setHighlight] = React.useState<{ messageId: string, seq: number } | null>(null)
  const pendingJumpRef = React.useRef<string | null>(null)

  // The scroll geometry as of the previous commit or scroll event.
  const anchorRef = React.useRef({ height: 0, top: 0 })
  const edgesRef = React.useRef<{ first: string | null, last: string | null }>({ first: null, last: null })
  const initialScrolledRef = React.useRef(false)
  const firstKey = rows[0]
    ? rowKey(rows[0])
    : null
  const lastKey = rows.at(-1)
    ? rowKey(rows.at(-1)!)
    : null

  const scrollToEnd = React.useCallback(() => {
    if (rows.length > 0)
      virtualizer.scrollToIndex(rows.length - 1, { align: 'end' })
  }, [rows.length, virtualizer])

  // Keeps the visible content in place across a prepend and follows appends at the bottom.
  React.useLayoutEffect(() => {
    const previous = edgesRef.current
    edgesRef.current = { first: firstKey, last: lastKey }
    const element = scrollRef.current
    if (!element || !ready || rows.length === 0)
      return
    if (!initialScrolledRef.current) {
      initialScrolledRef.current = true
      scrollToEnd()
      return
    }
    const keys = rows.map(rowKey)
    if (previous.first !== null && previous.first !== firstKey && keys.indexOf(previous.first) > 0)
      element.scrollTop = anchorRef.current.top + (element.scrollHeight - anchorRef.current.height)
    if (previous.last !== lastKey) {
      const previousIndex = previous.last === null
        ? -1
        : keys.indexOf(previous.last)
      if (previous.last === null || previousIndex !== -1) {
        if (atBottomRef.current) {
          scrollToEnd()
        }
        else {
          const arrived = rows.slice(previousIndex + 1).filter(row => row.kind === 'message').length
          setUnseen(count => count + arrived)
        }
      }
    }
  }, [
    firstKey,
    lastKey,
    ready,
    rows,
    scrollToEnd,
  ])

  // Declared after the effect above so that it reads the geometry before the change.
  React.useLayoutEffect(() => {
    const element = scrollRef.current
    if (element)
      anchorRef.current = { height: element.scrollHeight, top: element.scrollTop }
  })

  const firstIndex = virtualItems[0]?.index ?? 0
  React.useEffect(() => {
    if (!ready || !hasMore || paginating || pageFailed)
      return
    if (firstIndex < PAGINATE_ROW_THRESHOLD || nearTop) {
      paginate(chatId).catch((error: unknown) => {
        console.error('paginate_backwards failed', error)
        setPageFailed(true)
      })
    }
  }, [
    chatId,
    firstIndex,
    hasMore,
    nearTop,
    pageFailed,
    paginating,
    ready,
  ])

  function onScroll(): void {
    const element = scrollRef.current
    if (!element)
      return
    anchorRef.current = { height: element.scrollHeight, top: element.scrollTop }
    const bottom = element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_THRESHOLD_PX
    atBottomRef.current = bottom
    setAtBottom(bottom)
    if (bottom)
      setUnseen(0)
    setNearTop(element.scrollTop < element.clientHeight)
    setPageFailed(false)
  }

  const jumpTo = React.useCallback(async (messageId: string, maxPages = JUMP_MAX_PAGES) => {
    pendingJumpRef.current = messageId
    const found = () => selectMessageIndex(chatId, messageId)(timelineStore.getState()) !== -1
    for (let page = 0; page < maxPages && !found(); page++) {
      // A page already loading (the list's own) counts as this one.
      await pageIdle(chatId)
      if (found() || !(timelineStore.getState().byChat[chatId]?.hasMore ?? true))
        break
      try {
        await paginate(chatId)
      }
      catch {
        break
      }
    }
    if (pendingJumpRef.current !== messageId)
      return
    if (found())
      setHighlight(current => ({ messageId, seq: (current?.seq ?? 0) + 1 }))
    else
      pendingJumpRef.current = null
  }, [chatId])

  const jumpToHit = React.useCallback((messageId: string) => {
    void jumpTo(messageId, SEARCH_JUMP_MAX_PAGES)
  }, [jumpTo])

  // A search result opened from the palette, once the timeline is ready.
  const jumpRequest = useJumpRequest(state => state.request)
  React.useEffect(() => {
    if (!ready || jumpRequest?.chatId !== chatId)
      return
    useJumpRequest.getState().clear()
    jumpToHit(jumpRequest.messageId)
  }, [chatId, jumpRequest, jumpToHit, ready])

  // Scrolls once the rows holding the pending jump target are rendered.
  React.useEffect(() => {
    const messageId = pendingJumpRef.current
    if (messageId === null || highlight?.messageId !== messageId)
      return
    const index = rows.findIndex(row => row.kind === 'message' && row.item.messageId === messageId)
    if (index === -1)
      return
    pendingJumpRef.current = null
    virtualizer.scrollToIndex(index, { align: 'center' })
  }, [highlight, rows, virtualizer])

  React.useEffect(() => {
    if (highlight === null)
      return
    const timer = setTimeout(setHighlight, HIGHLIGHT_MS, null)
    return () => clearTimeout(timer)
  }, [highlight])

  function renderRow(row: Row): React.ReactNode {
    switch (row.kind) {
      case 'date':
        return <DateSeparator dayStartMs={row.dayStartMs} />
      case 'membership':
        return (
          <MembershipRow
            userName={row.userName}
            change={row.change}
            actorName={row.actorUserId === null
              ? null
              : nameOf(row.actorUserId)}
          />
        )
      case 'message':
        return (
          <MessageBubble
            message={row.item}
            first={row.first}
            last={row.last}
            isGroup={isGroup}
            highlighted={highlight?.messageId === row.item.messageId}
            nameOf={nameOf}
            onJump={(messageId) => {
              void jumpTo(messageId)
            }}
          />
        )
    }
  }

  const searchBar = <InChatSearch chatId={chatId} onJump={jumpToHit} />

  if (!ready) {
    return (
      <>
        {searchBar}
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 p-4" data-testid="message-list-loading">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-10 w-1/3 self-end" />
          <Skeleton className="h-10 w-2/5" />
        </div>
      </>
    )
  }

  return (
    <>
      {searchBar}
      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} className="h-full overflow-y-auto" onScroll={onScroll}>
          <div
            className="relative w-full"
            style={{
              height: virtualizer.getTotalSize(),
            }}
          >
            <p className="absolute inset-x-0 top-0 flex items-center justify-center text-xs text-muted-foreground" style={{ height: HISTORY_LINE_PX }}>
              {paginating
                ? t('pane.loadingHistory')
                : hasMore
                  ? null
                  : t('pane.startOfChat')}
            </p>
            {virtualItems.map(virtualItem => (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${virtualItem.start}px)` }}
              >
                {renderRow(rows[virtualItem.index]!)}
              </div>
            ))}
          </div>
        </div>
        {!atBottom && (
          <JumpToLatest
            count={unseen}
            onClick={() => {
              setUnseen(0)
              scrollToEnd()
            }}
          />
        )}
      </div>
    </>
  )
}
