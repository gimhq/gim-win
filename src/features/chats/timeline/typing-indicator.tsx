import type { NameOf } from './use-members'
import { useTranslation } from 'react-i18next'
import { selectTyping, useTimelineStore } from './store'

export function TypingIndicator({ chatId, nameOf }: { chatId: string, nameOf: NameOf }) {
  const { t } = useTranslation('chat')
  const typing = useTimelineStore(selectTyping(chatId))
  const names = typing.map(nameOf)
  const text = names.length === 0
    ? ''
    : names.length === 1
      ? t('pane.typing.one', { name: names[0] })
      : names.length === 2
        ? t('pane.typing.two', { a: names[0], b: names[1] })
        : t('pane.typing.many', { count: names.length })
  return (
    <p className="h-5 truncate px-4 text-xs text-muted-foreground" aria-live="polite">{text}</p>
  )
}
