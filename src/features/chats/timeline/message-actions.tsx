import type { MessageItem, SendFailure } from '@/lib/api'
import { cn } from 'cn'
import { CopyIcon, MoreHorizontalIcon, PencilIcon, ReplyIcon, RotateCcwIcon, SmilePlusIcon, Trash2Icon, XCircleIcon } from 'lucide-react'
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
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cancelSend, deleteMessage, react, retrySend, unreact } from '@/lib/api'
import { composerStore } from '../composer/store'
import { errorKey } from './error-text'
import { useChatState } from './use-chat-state'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

/** API.md "Timeline": Retry is hidden for these causes. */
const NO_RETRY: SendFailure[] = ['UserSuspended', 'UserNotAdmitted', 'NotAdmittedByPeer']

const COPIED_MS = 1500

type ActionId = 'reply' | 'edit' | 'delete' | 'copy' | 'retry' | 'cancel'

const ACTION_ICONS: Record<ActionId, React.ComponentType> = {
  reply: ReplyIcon,
  edit: PencilIcon,
  delete: Trash2Icon,
  copy: CopyIcon,
  retry: RotateCcwIcon,
  cancel: XCircleIcon,
}

const ACTION_KEYS: Record<ActionId, string> = {
  reply: 'actions.reply',
  edit: 'actions.edit',
  delete: 'actions.delete',
  copy: 'actions.copy',
  retry: 'actions.retry',
  cancel: 'actions.cancelSend',
}

/** The text Copy puts on the clipboard; null when there is none. */
function copyText(message: MessageItem): string | null {
  switch (message.content.type) {
    case 'Text':
      return message.content.body
    case 'Image':
    case 'File':
      return message.content.caption || null
    default:
      return null
  }
}

function actionsFor(message: MessageItem): ActionId[] {
  const deleted = message.content.type === 'Deleted'
  const failure = message.sendState?.type === 'Failed'
    ? message.sendState.cause
    : null
  const ids: ActionId[] = ['reply']
  if (message.isOwn && message.content.type === 'Text')
    ids.push('edit')
  if (copyText(message) !== null)
    ids.push('copy')
  if (message.isOwn && failure !== null) {
    if (!NO_RETRY.includes(failure))
      ids.push('retry')
    ids.push('cancel')
  }
  if (message.isOwn && !deleted)
    ids.push('delete')
  return ids
}

type ItemComponent = typeof ContextMenuItem | typeof DropdownMenuItem
type SeparatorComponent = typeof ContextMenuSeparator | typeof DropdownMenuSeparator

interface MenuItemsProps {
  message: MessageItem
  active: boolean
  Item: ItemComponent
  Separator: SeparatorComponent
  onAction: (id: ActionId) => void
  onReact: (emoji: string) => void
}

function MenuItems({ message, active, Item, Separator, onAction, onReact }: MenuItemsProps) {
  const { t } = useTranslation('chat')
  return (
    <>
      <div className="flex gap-0.5 px-0.5" role="group" aria-label={t('actions.react')}>
        {QUICK_REACTIONS.map(emoji => (
          <Item
            key={emoji}
            aria-label={emoji}
            disabled={!active}
            className="justify-center px-1 text-base"
            onClick={() => onReact(emoji)}
          >
            {emoji}
          </Item>
        ))}
      </div>
      <Separator />
      {actionsFor(message).map((id) => {
        const Icon = ACTION_ICONS[id]
        return (
          <Item
            key={id}
            disabled={id !== 'copy' && !active}
            variant={id === 'delete'
              ? 'destructive'
              : 'default'}
            onClick={() => onAction(id)}
          >
            <Icon />
            {t(ACTION_KEYS[id])}
          </Item>
        )
      })}
    </>
  )
}

/** The context menu, hover toolbar and their dialogs around one message bubble. */
export function MessageActions({ message, children }: { message: MessageItem, children: React.ReactNode }) {
  const { t } = useTranslation('chat')
  const active = useChatState(message.chatId) === 'Active'
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)
  const [reactOpen, setReactOpen] = React.useState(false)
  const { chatId, messageId } = message

  React.useEffect(() => {
    if (!copied)
      return
    const timer = setTimeout(setCopied, COPIED_MS, false)
    return () => clearTimeout(timer)
  }, [copied])

  function run(action: Promise<void>) {
    setError(null)
    action.catch(setError)
  }

  function onReact(emoji: string) {
    setReactOpen(false)
    const own = message.reactions.some(group => group.emoji === emoji && group.own)
    run(own
      ? unreact(chatId, messageId, emoji)
      : react(chatId, messageId, emoji))
  }

  function onAction(id: ActionId) {
    switch (id) {
      case 'reply':
        composerStore.getState().setReplyTo(message)
        break
      case 'edit':
        composerStore.getState().startEdit(message)
        break
      case 'delete':
        setConfirmDelete(true)
        break
      case 'copy':
        run(navigator.clipboard.writeText(copyText(message) ?? '').then(() => setCopied(true)))
        break
      case 'retry':
        run(retrySend(chatId, messageId))
        break
      case 'cancel':
        run(cancelSend(chatId, messageId))
        break
    }
  }

  const menuProps = { message, active, onAction, onReact }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          className={cn('group/message flex min-w-0 items-center gap-1 select-text', message.isOwn && 'flex-row-reverse')}
        >
          {children}
          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100 has-data-popup-open:opacity-100">
            <Popover open={reactOpen} onOpenChange={setReactOpen}>
              <PopoverTrigger
                render={<Button variant="ghost" size="icon-xs" aria-label={t('actions.react')} title={t('actions.react')} disabled={!active} />}
              >
                <SmilePlusIcon />
              </PopoverTrigger>
              <PopoverContent className="w-auto flex-row gap-0.5 p-1">
                {QUICK_REACTIONS.map(emoji => (
                  <Button key={emoji} variant="ghost" size="icon-sm" aria-label={emoji} className="text-base" onClick={() => onReact(emoji)}>
                    {emoji}
                  </Button>
                ))}
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={t('actions.more')} title={t('actions.more')} />}>
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align={message.isOwn
                ? 'end'
                : 'start'}
              >
                <MenuItems {...menuProps} Item={DropdownMenuItem} Separator={DropdownMenuSeparator} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <MenuItems {...menuProps} Item={ContextMenuItem} Separator={ContextMenuSeparator} />
        </ContextMenuContent>
      </ContextMenu>
      {copied && <span role="status" className="mt-0.5 text-xs text-muted-foreground">{t('actions.copied')}</span>}
      {error !== null && <p role="alert" className="mt-0.5 text-xs text-destructive">{t(errorKey(error))}</p>}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('actions.deleteConfirm.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false)
                run(deleteMessage(chatId, messageId))
              }}
            >
              {t('actions.deleteConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
