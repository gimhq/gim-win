import type { LucideIcon } from 'lucide-react'
import type { SendState } from '@/lib/api'
import { cn } from 'cn'
import { CheckCheckIcon, CheckIcon, CircleAlertIcon, ClockIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const TICKS: Record<SendState['type'], { icon: LucideIcon, label: string, className?: string }> = {
  Pending: { icon: ClockIcon, label: 'pane.status.pending' },
  Sent: { icon: CheckIcon, label: 'pane.status.sent' },
  Delivered: { icon: CheckCheckIcon, label: 'pane.status.delivered' },
  Read: { icon: CheckCheckIcon, label: 'pane.status.read', className: 'text-primary' },
  Failed: { icon: CircleAlertIcon, label: 'pane.status.failed', className: 'text-destructive' },
}

/** The send state of an own message as an icon; `Failed` adds a tooltip. */
export function StatusTicks({ state, className }: { state: SendState, className?: string }) {
  const { t } = useTranslation('chat')
  const tick = TICKS[state.type]
  const Icon = tick.icon
  const icon = <Icon className={cn('size-3.5 shrink-0', tick.className, className)} role="img" aria-label={t(tick.label)} />
  if (state.type !== 'Failed')
    return icon
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{icon}</TooltipTrigger>
      <TooltipContent>{t('pane.status.failed')}</TooltipContent>
    </Tooltip>
  )
}
