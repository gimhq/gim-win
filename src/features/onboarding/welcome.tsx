import { Link } from '@tanstack/react-router'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { OnboardingFrame } from './frame'

/** Set once the intro pages were seen (or skipped) in this session. */
export const INTRO_SEEN_KEY = 'gim.onboarding.introSeen'

const INTRO_PAGES = ['noPhone', 'onYourDevices', 'lockedMessages'] as const

function introSeen(): boolean {
  return sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
}

export function WelcomePage() {
  const { t } = useTranslation('onboarding')
  // `null` means the intro is over and the choice is shown.
  const [page, setPage] = React.useState<number | null>(() => introSeen()
    ? null
    : 0)

  function finishIntro() {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    setPage(null)
  }

  if (page === null) {
    return (
      <OnboardingFrame title={t('titles.welcome')} description={t('welcome.explanation')}>
        <div className="flex flex-col gap-2">
          <Button size="lg" render={<Link to="/onboarding/link" />}>
            {t('welcome.link')}
          </Button>
          <Button size="lg" variant="outline" render={<Link to="/onboarding/create" />}>
            {t('welcome.create')}
          </Button>
          <Button size="lg" variant="outline" render={<Link to="/onboarding/restore" />}>
            {t('welcome.restore')}
          </Button>
        </div>
      </OnboardingFrame>
    )
  }

  const key = INTRO_PAGES[page]!
  const last = page === INTRO_PAGES.length - 1
  return (
    <OnboardingFrame
      title={t('titles.welcome')}
      actions={(
        <>
          <span className="flex-1 text-sm text-muted-foreground">
            {t('intro.page', { current: page + 1, total: INTRO_PAGES.length })}
          </span>
          <Button variant="ghost" onClick={finishIntro}>{t('intro.skip')}</Button>
          <Button onClick={() => (last
            ? finishIntro()
            : setPage(page + 1))}
          >
            {last
              ? t('intro.start')
              : t('common:actions.next')}
          </Button>
        </>
      )}
    >
      <Card>
        <CardHeader>
          <h2 className="font-heading text-base leading-snug font-medium">{t(`intro.${key}.title`)}</h2>
          <CardDescription>{t(`intro.${key}.body`)}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </OnboardingFrame>
  )
}
