import { ArrowDownIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/** Floats over the list while it is scrolled up; `count` is the messages arrived meanwhile. */
export function JumpToLatest({ count, onClick }: { count: number, onClick: () => void }) {
  const { t } = useTranslation('chat')
  return (
    <Button
      variant="secondary"
      size="sm"
      className="absolute right-4 bottom-3 shadow-md"
      onClick={onClick}
    >
      <ArrowDownIcon />
      {t('pane.jumpToLatest')}
      {count > 0 && <Badge>{count}</Badge>}
    </Button>
  )
}
