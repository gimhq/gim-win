import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import { useTranslation } from 'react-i18next'
import { Separator } from '@/components/ui/separator'

/** The C4 order; `signOut` sits after a divider at the bottom. */
const SECTIONS = [
  { key: 'profile', to: '/settings/profile' },
  { key: 'devices', to: '/settings/devices' },
  { key: 'notifications', to: '/settings/notifications' },
  { key: 'appearance', to: '/settings/appearance' },
  { key: 'language', to: '/settings/language' },
  { key: 'advanced', to: '/settings/advanced' },
  { key: 'about', to: '/settings/about' },
] as const

const SIGN_OUT = { key: 'signOut', to: '/settings/signout' } as const

const linkClass = 'rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground'

function SectionLink({ section, className }: { section: typeof SECTIONS[number] | typeof SIGN_OUT, className?: string }) {
  const { t } = useTranslation('settings')
  return (
    <Link
      to={section.to}
      className={cn(linkClass, className)}
      activeProps={{ className: 'bg-accent text-accent-foreground' }}
    >
      {t(`titles.${section.key}`)}
    </Link>
  )
}

/** The settings navigation: seven sections, a divider, then sign out. */
export function SettingsSectionList() {
  const { t } = useTranslation('settings')
  return (
    <nav aria-label={t('titles.settings')} className="flex w-56 shrink-0 flex-col border-r border-border p-2">
      <h2 className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t('titles.settings')}</h2>
      {SECTIONS.map(section => <SectionLink key={section.key} section={section} />)}
      <Separator className="my-2" />
      <SectionLink section={SIGN_OUT} className="text-destructive hover:text-destructive" />
    </nav>
  )
}
