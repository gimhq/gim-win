import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/_shell/settings')({
  component: SettingsLayout,
})

const SECTIONS = [
  { key: 'profile', to: '/settings/profile' },
  { key: 'devices', to: '/settings/devices' },
  { key: 'notifications', to: '/settings/notifications' },
  { key: 'appearance', to: '/settings/appearance' },
  { key: 'language', to: '/settings/language' },
  { key: 'advanced', to: '/settings/advanced' },
  { key: 'about', to: '/settings/about' },
  { key: 'signOut', to: '/settings/signout' },
] as const

function SettingsLayout() {
  const { t } = useTranslation('settings')
  return (
    <div className="flex flex-1 overflow-hidden">
      <nav aria-label={t('titles.settings')} className="flex w-56 shrink-0 flex-col border-r border-border p-2">
        <h2 className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t('titles.settings')}</h2>
        {SECTIONS.map(section => (
          <Link
            key={section.key}
            to={section.to}
            className="rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            activeProps={{ className: 'bg-accent text-accent-foreground' }}
          >
            {t(`titles.${section.key}`)}
          </Link>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
