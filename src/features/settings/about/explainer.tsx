import { useTranslation } from 'react-i18next'

const ITEMS = [
  'noPhoneNumber',
  'onYourDevices',
  'lockedMessages',
  'accountId',
  'recoveryKey',
] as const

/** How gim works: the intro and five titled points; shared with onboarding. */
export function Explainer() {
  const { t } = useTranslation('settings')
  return (
    <div className="flex flex-col gap-3 px-1">
      <p className="text-sm">{t('about.explainer.intro')}</p>
      <ul className="flex flex-col gap-3">
        {ITEMS.map(item => (
          <li key={item} className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t(`about.explainer.${item}.title`)}</span>
            <span className="text-sm text-muted-foreground">{t(`about.explainer.${item}.body`)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
