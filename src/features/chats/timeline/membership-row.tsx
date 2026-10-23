import type { MembershipChangeKind } from '@/lib/api'
import { useTranslation } from 'react-i18next'

const KEYS: Record<MembershipChangeKind, { actor: string, noActor: string }> = {
  Added: { actor: 'pane.membership.added', noActor: 'pane.membership.addedNoActor' },
  Removed: { actor: 'pane.membership.removed', noActor: 'pane.membership.removedNoActor' },
  Left: { actor: 'pane.membership.left', noActor: 'pane.membership.left' },
}

interface MembershipRowProps {
  userName: string
  change: MembershipChangeKind
  /** The resolved actor name; null when unknown. */
  actorName: string | null
}

export function MembershipRow({ userName, change, actorName }: MembershipRowProps) {
  const { t } = useTranslation('chat')
  const keys = KEYS[change]
  return (
    <p className="py-1 text-center text-xs text-muted-foreground">
      {actorName === null
        ? t(keys.noActor, { name: userName })
        : t(keys.actor, { name: userName, actor: actorName })}
    </p>
  )
}
