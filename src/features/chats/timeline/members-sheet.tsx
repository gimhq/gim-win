import type { UserProfile } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UsersIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { addMembers, chatMembers, isGimError, leaveChat, removeMember, session } from '@/lib/api'
import { popScope, pushScope, register } from '@/lib/shortcuts'
import { ChatAvatar } from '../components/chat-avatar'
import { extractUserId } from '../lib/user-id'
import { selectChat, useChatListStore } from '../store'
import { errorKey } from './error-text'
import { useChatState } from './use-chat-state'

export const SHEET_SCOPE = 'sheet'

class InvalidId extends Error {}

/** As New chat: the Account ID anywhere in the text. */
function resolveUserId(text: string): string {
  const userId = extractUserId(text)
  if (!userId)
    throw new InvalidId()
  return userId
}

function nameOf(profile: UserProfile): string {
  return profile.displayName || profile.userId.slice(0, 8)
}

type Confirm = { kind: 'remove', member: UserProfile } | { kind: 'leave' }

/** The header action that opens the members sheet. */
export function MembersButton({ chatId }: { chatId: string }) {
  const { t } = useTranslation('chat')
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="ghost" size="icon" aria-label={t('members.title')} title={t('members.title')} onClick={() => setOpen(true)}>
        <UsersIcon />
      </Button>
      <MembersSheet chatId={chatId} open={open} onOpenChange={setOpen} />
    </>
  )
}

/** Members of a group (add, remove, leave); a direct chat shows the peer and Leave only. */
export function MembersSheet({ chatId, open, onOpenChange }: { chatId: string, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation('chat')
  const queryClient = useQueryClient()
  const chat = useChatListStore(selectChat(chatId))
  const active = useChatState(chatId) === 'Active'
  const isGroup = chat?.kind === 'Group'
  const [query, setQuery] = React.useState('')
  const [confirm, setConfirm] = React.useState<Confirm | null>(null)
  const { data: account } = useQuery({
    queryKey: ['session'],
    queryFn: session,
    enabled: open,
  })
  const members = useQuery({
    queryKey: ['chatMembers', chatId],
    queryFn: () => chatMembers(chatId),
    enabled: open && isGroup,
  })
  const shown = isGroup
    ? members.data ?? []
    : chat?.peer
      ? [chat.peer]
      : []

  const invalidate = () => queryClient.invalidateQueries({
    queryKey: ['chatMembers', chatId],
  })
  const add = useMutation({
    mutationFn: async (text: string) => addMembers(chatId, [
      resolveUserId(text),
    ]),
    onSuccess: () => setQuery(''),
    onSettled: invalidate,
  })
  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(chatId, userId),
    onSettled: invalidate,
  })
  const leave = useMutation({
    mutationFn: () => leaveChat(chatId),
    onSuccess: () => onOpenChange(false),
    onSettled: invalidate,
  })
  const error = add.error ?? remove.error ?? leave.error
  const busy = add.isPending || remove.isPending || leave.isPending

  React.useEffect(() => {
    if (!open)
      return
    pushScope(SHEET_SCOPE)
    const unregister = register(SHEET_SCOPE, 'Escape', () => onOpenChange(false))
    return () => {
      unregister()
      popScope(SHEET_SCOPE)
    }
  }, [open, onOpenChange])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (query.trim() && active && !busy)
      add.mutate(query)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-3 p-4">
        <SheetHeader className="p-0">
          <SheetTitle>{t('members.title')}</SheetTitle>
        </SheetHeader>
        {isGroup && (
          <form className="flex gap-2" onSubmit={submit}>
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                add.reset()
              }}
              placeholder={t('members.addPlaceholder')}
              aria-label={t('members.addPlaceholder')}
              disabled={!active}
            />
            <Button type="submit" variant="outline" disabled={!active || busy || !query.trim()}>
              {t('members.add')}
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error instanceof InvalidId
              ? t('newChat.invalidId')
              : isGimError(error) && (error.kind === 'NotFound' || error.kind === 'InvalidInput')
                ? t('newChat.notFound')
                : t(errorKey(error))}
          </p>
        )}
        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {shown.map((member) => {
            const self = member.userId === account?.userId
            return (
              <li key={member.userId} className="flex items-center gap-2 rounded-md px-1 py-1.5">
                <ChatAvatar name={nameOf(member)} colorKey={member.userId} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{nameOf(member)}</span>
                {self && <span className="text-xs text-muted-foreground">{t('members.you')}</span>}
                {isGroup && !self && (
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={!active || busy}
                    onClick={() => setConfirm({ kind: 'remove', member })}
                  >
                    {t('members.remove')}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        <Button variant="destructive" disabled={!active || busy} onClick={() => setConfirm({ kind: 'leave' })}>
          {t('members.leave')}
        </Button>
      </SheetContent>
      <AlertDialog open={confirm !== null} onOpenChange={next => !next && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'remove'
                ? t('members.removeConfirm', {
                    name: nameOf(confirm.member),
                  })
                : t('members.leaveConfirm.title')}
            </AlertDialogTitle>
            {confirm?.kind === 'leave' && <AlertDialogDescription>{t('members.leaveConfirm.body')}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirm?.kind === 'remove')
                  remove.mutate(confirm.member.userId)
                else
                  leave.mutate()
                setConfirm(null)
              }}
            >
              {confirm?.kind === 'remove'
                ? t('members.remove')
                : t('members.leaveConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
