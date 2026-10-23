import type { MessageItem } from '@/lib/api'
import { PaperclipIcon, PencilIcon, ReplyIcon, SendHorizontalIcon, XIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { editMessage, isGimError, sendMedia, sendText } from '@/lib/api'
import { popScope, pushScope, register } from '@/lib/shortcuts'
import { isImageMime } from '../lib/mime'
import { errorKey } from '../timeline/error-text'
import { useChatState } from '../timeline/use-chat-state'
import { useMembers } from '../timeline/use-members'
import { AttachmentStrip } from './attachment-strip'
import { composerStore, useComposerStore } from './store'
import { addPastedImages, pickAttachments, useAttachments } from './use-attachments'
import { useTyping } from './use-typing'

export const COMPOSER_SCOPE = 'composer'

function quoteOf(message: MessageItem): string {
  switch (message.content.type) {
    case 'Text':
      return message.content.body
    case 'Image':
    case 'File':
      return message.content.caption ?? ''
    default:
      return ''
  }
}

/** Sends the input and the attachments; the text captions a single image, else goes first. */
async function send(chatId: string, body: string, replyTo: string | null): Promise<void> {
  const { attachments } = composerStore.getState()
  const single = attachments.length === 1
    ? attachments[0]!
    : null
  const textAsCaption = !!body && !!single && isImageMime(single.mime) && !single.caption.trim()
  let reply = replyTo
  if (body && !textAsCaption) {
    await sendText(chatId, body, reply)
    reply = null
  }
  for (const attachment of attachments) {
    const caption = textAsCaption
      ? body
      : attachment.caption.trim() || null
    await sendMedia(chatId, attachment.path, attachment.mime, caption, reply)
    reply = null
    composerStore.getState().removeAttachment(attachment.id)
  }
}

function ModeBar({ icon, title, quote, closeLabel, onClose }: {
  icon: React.ReactNode
  title: string
  quote: string
  closeLabel: string
  onClose: () => void
}) {
  return (
    <div className="flex items-center gap-2 border-l-2 border-primary px-2 py-1 text-xs">
      {icon}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium text-primary">{title}</span>
        {quote && <span className="truncate text-muted-foreground">{quote}</span>}
      </div>
      <Button variant="ghost" size="icon-xs" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
        <XIcon />
      </Button>
    </div>
  )
}

/** The message input of the chat pane: text, reply and edit modes, attachments. */
export function Composer({ chatId }: { chatId: string }) {
  const { t } = useTranslation('chat')
  const state = useChatState(chatId)
  const { nameOf } = useMembers(chatId)
  const text = useComposerStore(s => s.text)
  const replyTo = useComposerStore(s => s.replyTo)
  const editing = useComposerStore(s => s.editing)
  const attachments = useAttachments()
  const typing = useTyping(chatId)
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => () => composerStore.getState().reset(), [chatId])

  React.useEffect(() => {
    if (replyTo || editing)
      textareaRef.current?.focus()
  }, [replyTo, editing])

  const hasMode = !!(replyTo || editing)
  React.useEffect(() => {
    if (!hasMode)
      return
    pushScope(COMPOSER_SCOPE)
    const unregister = register(COMPOSER_SCOPE, 'Escape', () => {
      const { editing: current } = composerStore.getState()
      if (current)
        composerStore.getState().cancelEdit()
      else
        composerStore.getState().setReplyTo(null)
    })
    return () => {
      unregister()
      popScope(COMPOSER_SCOPE)
    }
  }, [hasMode])

  const notActive = isGimError(error) && error.kind === 'ChatNotActive'
    ? error.state
    : null
  const blocked = state === 'Leaving' || state === 'Left'
    ? state
    : notActive
  if (blocked) {
    return (
      <p role="status" className="border-t border-border px-4 py-3 text-center text-sm text-muted-foreground">
        {t(blocked === 'Leaving'
          ? 'composer.disabled.leaving'
          : 'composer.disabled.left')}
      </p>
    )
  }

  async function submit() {
    const body = text.trim()
    if (sending)
      return
    if (editing) {
      if (!body)
        return
      setSending(true)
      setError(null)
      try {
        if (editing.content.type !== 'Text' || body !== editing.content.body)
          await editMessage(chatId, editing.messageId, body)
        composerStore.getState().cancelEdit()
        typing.stop()
      }
      catch (caught) {
        setError(caught)
      }
      finally {
        setSending(false)
      }
      return
    }
    if (!body && attachments.length === 0)
      return
    setSending(true)
    setError(null)
    const reply = replyTo?.messageId ?? null
    composerStore.getState().setText('')
    composerStore.getState().setReplyTo(null)
    typing.stop()
    try {
      await send(chatId, body, reply)
    }
    catch (caught) {
      setError(caught)
    }
    finally {
      setSending(false)
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229)
      return
    event.preventDefault()
    void submit()
  }

  function onPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const images = Array.from(event.clipboardData.files).filter(file => file.type.startsWith('image/'))
    if (images.length === 0)
      return
    event.preventDefault()
    addPastedImages(images).catch(setError)
  }

  return (
    <div className="flex flex-col gap-1 border-t border-border pb-2">
      <AttachmentStrip attachments={attachments} />
      {(replyTo || editing) && (
        <div className="px-3 pt-2">
          {editing
            ? (
                <ModeBar
                  icon={<PencilIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                  title={t('composer.editing')}
                  quote={quoteOf(editing)}
                  closeLabel={t('composer.cancelEdit')}
                  onClose={() => composerStore.getState().cancelEdit()}
                />
              )
            : replyTo && (
              <ModeBar
                icon={<ReplyIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                title={t('pane.replyingTo', { name: replyTo.sender.displayName || nameOf(replyTo.sender.userId) })}
                quote={quoteOf(replyTo)}
                closeLabel={t('composer.cancelReply')}
                onClose={() => composerStore.getState().setReplyTo(null)}
              />
            )}
        </div>
      )}
      {error !== null && !notActive && <p role="alert" className="px-4 text-xs text-destructive">{t(errorKey(error))}</p>}
      <div className="flex items-end gap-1 px-3 pt-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('composer.attach')}
          title={t('composer.attach')}
          disabled={!!editing}
          onClick={() => {
            pickAttachments().catch(setError)
          }}
        >
          <PaperclipIcon />
        </Button>
        <Textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(event) => {
            composerStore.getState().setText(event.target.value)
            typing.onInput(event.target.value)
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={t('composer.placeholder')}
          aria-label={t('composer.placeholder')}
          title={t('composer.newline')}
          className="max-h-[calc(8lh+1rem)] min-h-9 resize-none overflow-y-auto"
        />
        <Button
          size="icon"
          aria-label={t('composer.send')}
          title={t('composer.send')}
          disabled={sending}
          onClick={() => void submit()}
        >
          <SendHorizontalIcon />
        </Button>
      </div>
    </div>
  )
}
