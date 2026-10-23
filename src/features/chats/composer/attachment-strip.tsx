import type { Attachment } from './store'
import { convertFileSrc } from '@tauri-apps/api/core'
import { FileIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isImageMime } from '../lib/mime'
import { composerStore } from './store'

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const { t } = useTranslation('chat')
  const image = isImageMime(attachment.mime)
  return (
    <li className="flex w-40 shrink-0 flex-col gap-1 rounded-lg border border-border bg-muted/40 p-1.5">
      <div className="flex items-center gap-1.5">
        {image && attachment.previewable
          ? <img src={convertFileSrc(attachment.path)} alt={attachment.name} className="size-10 shrink-0 rounded object-cover" />
          : <FileIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate text-xs" title={attachment.path}>{attachment.name}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t('composer.remove')}
          title={t('composer.remove')}
          onClick={() => composerStore.getState().removeAttachment(attachment.id)}
        >
          <XIcon />
        </Button>
      </div>
      {image && (
        <Input
          value={attachment.caption}
          onChange={event => composerStore.getState().setCaption(attachment.id, event.target.value)}
          placeholder={t('composer.captionPlaceholder')}
          aria-label={t('composer.caption')}
          className="h-7 text-xs"
        />
      )}
    </li>
  )
}

/** The attachments queued in the composer. */
export function AttachmentStrip({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0)
    return null
  return (
    <ul className="flex gap-2 overflow-x-auto px-3 pt-2">
      {attachments.map(attachment => <AttachmentCard key={attachment.id} attachment={attachment} />)}
    </ul>
  )
}
