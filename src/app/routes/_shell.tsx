import type { Theme } from '@/app/theme'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { THEMES, useTheme } from '@/app/theme'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChatsSidebar } from '@/features/chats/components/chats-sidebar'
import { chatListStore } from '@/features/chats/store'
import { SystemIntegration } from '@/features/system/system-integration'
import { startup } from '@/lib/api'

export const Route = createFileRoute('/_shell')({
  beforeLoad: async () => {
    const info = await startup()
    if (!info.clientReady || !info.session)
      throw redirect({ to: '/onboarding' })
  },
  component: ShellLayout,
})

const THEME_ICONS = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
} as const

function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const Icon = THEME_ICONS[theme]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={t('settings:titles.appearance')} />}
      >
        <Icon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={value => setTheme(value as Theme)}>
          {THEMES.map(mode => (
            <DropdownMenuRadioItem key={mode} value={mode}>
              {t(`theme.${mode}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ShellLayout() {
  React.useEffect(() => {
    void chatListStore.getState().start()
    return () => {
      void chatListStore.getState().stop()
    }
  }, [])

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-background text-foreground">
      <SystemIntegration />
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-border">
        <ChatsSidebar actions={<ThemeToggle />} />
      </aside>
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </section>
    </div>
  )
}
