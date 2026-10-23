import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { coreVersion } from '@/lib/api'
import { version as appVersion } from '../../../../package.json'
import { SettingsGroup, SettingsPage, SettingsRow } from '../ui'
import { Explainer } from './explainer'
import { LicencesPage } from './licences-page'

function CoreVersion() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['coreVersion'],
    queryFn: coreVersion,
  })
  if (query.isPending)
    return t('state.loading')
  if (query.isError)
    return t('errors.generic')
  return query.data
}

/** Help and about: how gim works, the versions and the licences list. */
export function AboutSection() {
  const { t } = useTranslation('settings')
  const [showLicences, setShowLicences] = React.useState(false)

  if (showLicences)
    return <LicencesPage onBack={() => setShowLicences(false)} />

  return (
    <SettingsPage title={t('titles.about')}>
      <SettingsGroup title={t('about.howItWorks')}>
        <Explainer />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow label={t('about.appVersion')}>
          <span className="text-sm text-muted-foreground">{appVersion}</span>
        </SettingsRow>
        <SettingsRow label={t('about.coreVersion')}>
          <span className="text-sm text-muted-foreground"><CoreVersion /></span>
        </SettingsRow>
        <div className="px-1 py-2">
          <Button variant="outline" size="sm" onClick={() => setShowLicences(true)}>
            {t('about.licences')}
          </Button>
        </div>
      </SettingsGroup>
    </SettingsPage>
  )
}
