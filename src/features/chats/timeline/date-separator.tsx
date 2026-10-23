import { useTranslation } from 'react-i18next'
import { formatDayLabel } from '@/lib/format'

export function DateSeparator({ dayStartMs }: { dayStartMs: number }) {
  const { t } = useTranslation('chat')
  const label = formatDayLabel(dayStartMs)
  const text = label.kind === 'date'
    ? label.text
    : t(`pane.${label.kind}`)
  return (
    <div className="flex justify-center py-2" role="separator" aria-label={text}>
      <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">{text}</span>
    </div>
  )
}
