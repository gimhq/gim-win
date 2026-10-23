import { ArrowLeftIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SettingsGroup, SettingsPage } from '../ui'
// Generated: run `bun install`, then `bun run licences` (scripts/licences.mjs).
import licences from './licences.json'

/** The open-source licences of the direct npm and cargo dependencies. */
export function LicencesPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation(['settings', 'common'])
  return (
    <SettingsPage title={t('about.licences')} description={t('about.licencesIntro')}>
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon />
          {t('common:actions.back')}
        </Button>
      </div>
      <SettingsGroup>
        <ul className="flex flex-col gap-1 px-1 text-sm">
          {licences.map(entry => (
            <li key={`${entry.source}:${entry.name}`}>
              {`${entry.name} ${entry.version} — ${entry.licence}`}
            </li>
          ))}
        </ul>
      </SettingsGroup>
    </SettingsPage>
  )
}
