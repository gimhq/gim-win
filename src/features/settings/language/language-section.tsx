import type { Language } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { LANGUAGE_NAMES, setLanguage, SUPPORTED_LANGUAGES } from '@/i18n'
import { SettingsGroup, SettingsPage } from '../ui'

export function LanguageSection() {
  const { t, i18n } = useTranslation('settings')

  return (
    <SettingsPage title={t('titles.language')} description={t('language.hint')}>
      <SettingsGroup title={t('language.pick')}>
        <RadioGroup
          aria-label={t('language.pick')}
          value={i18n.language}
          onValueChange={value => void setLanguage(value as Language)}
          className="px-1 py-2"
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const name = t(`common:languages.${lang}`, { defaultValue: LANGUAGE_NAMES[lang] })
            return (
              <Label key={lang} lang={lang}>
                <RadioGroupItem value={lang} aria-label={name} />
                {name}
              </Label>
            )
          })}
        </RadioGroup>
      </SettingsGroup>
    </SettingsPage>
  )
}
