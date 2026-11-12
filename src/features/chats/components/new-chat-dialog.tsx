import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { cn } from 'cn'
import { NotebookPenIcon, QrCodeIcon, XIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createDirectChat, createGroupChat, isGimError } from '@/lib/api'
import { useNewChatDialog } from '../hooks/use-new-chat-dialog'
import { openNoteToSelf } from '../lib/note-to-self'
import { decodeQrFromImage } from '../lib/qr'
import { extractUserId } from '../lib/user-id'

type Failure = 'invalidId' | 'qrNotFound'

class ResolveFailure extends Error {
  constructor(readonly failure: Failure) {
    super(failure)
  }
}

interface Member {
  userId: string
  label: string
}

/** The Account ID anywhere in the text; users are found by Account ID only. */
async function resolveMember(text: string): Promise<Member> {
  const userId = extractUserId(text)
  if (!userId)
    throw new ResolveFailure('invalidId')
  return { userId, label: userId }
}

/** The Account ID in a QR code image ("My QR code" carries the plain id). */
async function memberFromImage(image: Blob): Promise<Member> {
  const text = await decodeQrFromImage(image)
  if (text === null)
    throw new ResolveFailure('qrNotFound')
  const userId = extractUserId(text)
  if (!userId)
    throw new ResolveFailure('invalidId')
  return { userId, label: userId }
}

function useErrorText(): (error: unknown) => string {
  const { t } = useTranslation('chat')
  return (error) => {
    if (error instanceof ResolveFailure)
      return t(`newChat.${error.failure}`)
    if (isGimError(error)) {
      switch (error.kind) {
        case 'Network':
          return t('errors.offline')
        case 'NotFound':
        case 'InvalidInput':
          return t('newChat.notFound')
      }
    }
    return t('errors.generic')
  }
}

function ErrorText({ id, error }: { id: string, error: unknown }) {
  const errorText = useErrorText()
  return <p id={id} role="alert" className="text-sm text-destructive">{errorText(error)}</p>
}

function DirectTab({ onCreated }: { onCreated: (chatId: string) => void }) {
  const { t } = useTranslation('chat')
  const errorId = React.useId()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [text, setText] = React.useState('')
  const start = useMutation({
    mutationFn: async (source: string | Blob) => {
      const member = typeof source === 'string'
        ? await resolveMember(source)
        : await memberFromImage(source)
      return createDirectChat(member.userId)
    },
    onSuccess: onCreated,
  })
  const note = useMutation({
    mutationFn: openNoteToSelf,
    onSuccess: onCreated,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (text.trim() && !start.isPending)
      start.mutate(text)
  }

  function pasteImage(event: React.ClipboardEvent) {
    const image = Array.from(event.clipboardData.files).find(file => file.type.startsWith('image/'))
    if (!image || start.isPending)
      return
    event.preventDefault()
    start.mutate(image)
  }

  function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file && !start.isPending)
      start.mutate(file)
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit} onPaste={pasteImage}>
      <Button type="button" variant="ghost" className="justify-start" disabled={note.isPending} onClick={() => note.mutate()}>
        <NotebookPenIcon />
        {t('noteToSelf.title')}
      </Button>
      {note.isError && <ErrorText id={`${errorId}-note`} error={note.error} />}
      <div className="flex gap-2">
        <Input
          autoFocus
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            start.reset()
          }}
          placeholder={t('newChat.idPlaceholder')}
          aria-label={t('newChat.idPlaceholder')}
          aria-invalid={start.isError || undefined}
          aria-describedby={start.isError ? errorId : undefined}
        />
        <Button type="submit" disabled={!text.trim() || start.isPending}>
          {start.isPending
            ? t('newChat.creating')
            : t('newChat.startDirect')}
        </Button>
      </div>
      {start.isError && <ErrorText id={errorId} error={start.error} />}
      <p className="text-xs text-muted-foreground">{t('newChat.pasteHint')}</p>
      <div className="flex flex-col items-start gap-1">
        <Button type="button" variant="outline" disabled={start.isPending} onClick={() => fileInputRef.current?.click()}>
          <QrCodeIcon />
          {t('newChat.scanQr')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('newChat.scanQrHint')}</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="qr-file-input"
        onChange={pickImage}
      />
    </form>
  )
}

function GroupTab({ onCreated }: { onCreated: (chatId: string) => void }) {
  const { t } = useTranslation('chat')
  const nameId = React.useId()
  const errorId = React.useId()
  const [name, setName] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [members, setMembers] = React.useState<Member[]>([])
  const add = useMutation({
    mutationFn: resolveMember,
    onSuccess: (member) => {
      setMembers(current => current.some(m => m.userId === member.userId)
        ? current
        : [...current, member])
      setQuery('')
    },
  })
  const create = useMutation({
    mutationFn: () => createGroupChat(name.trim(), members.map(member => member.userId)),
    onSuccess: onCreated,
  })
  const error = add.error ?? create.error

  function addMember(event: React.FormEvent) {
    event.preventDefault()
    if (query.trim() && !add.isPending)
      add.mutate(query)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>{t('newChat.group.name')}</Label>
        <Input
          id={nameId}
          autoFocus
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder={t('newChat.group.namePlaceholder')}
        />
      </div>
      <form className="flex gap-2" onSubmit={addMember}>
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            add.reset()
          }}
          placeholder={t('newChat.idPlaceholder')}
          aria-label={t('newChat.group.addMember')}
          aria-invalid={add.isError || undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <Button type="submit" variant="outline" disabled={!query.trim() || add.isPending}>
          {t('newChat.group.addMember')}
        </Button>
      </form>
      {error && <ErrorText id={errorId} error={error} />}
      <p className="text-xs text-muted-foreground">{t('newChat.pasteHint')}</p>
      {members.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{t('newChat.group.members', { count: members.length })}</p>
          <ul className="flex flex-wrap gap-1.5">
            {members.map(member => (
              <li key={member.userId} className="flex max-w-full items-center gap-1 rounded-full bg-muted py-0.5 pr-0.5 pl-2.5 text-sm">
                <span className="truncate">{member.label}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="rounded-full"
                  aria-label={t('newChat.group.remove', { name: member.label })}
                  onClick={() => setMembers(current => current.filter(m => m.userId !== member.userId))}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button
        className="self-end"
        disabled={!name.trim() || members.length === 0 || create.isPending}
        onClick={() => create.mutate()}
      >
        {create.isPending
          ? t('newChat.creating')
          : t('newChat.group.create')}
      </Button>
    </div>
  )
}

type Tab = 'direct' | 'group'
const TABS: Tab[] = ['direct', 'group']

/** New chat: a direct chat by Account ID or QR image, or a new group. */
export function NewChatDialog() {
  const { t } = useTranslation('chat')
  const navigate = useNavigate()
  const open = useNewChatDialog(state => state.open)
  const setOpen = useNewChatDialog(state => state.setOpen)
  const [tab, setTab] = React.useState<Tab>('direct')

  function openChat(chatId: string) {
    setOpen(false)
    void navigate({
      to: '/chats/$chatId',
      params: { chatId },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next)
          setTab('direct')
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {tab === 'group'
              ? t('newChat.group.title')
              : t('newChat.title')}
          </DialogTitle>
        </DialogHeader>
        <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-0.5">
          {TABS.map(value => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={cn(
                'flex-1 rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors',
                tab === value && 'bg-background text-foreground shadow-sm',
              )}
              onClick={() => setTab(value)}
            >
              {t(`newChat.tabs.${value}`)}
            </button>
          ))}
        </div>
        {tab === 'direct'
          ? <DirectTab onCreated={openChat} />
          : <GroupTab onCreated={openChat} />}
      </DialogContent>
    </Dialog>
  )
}
