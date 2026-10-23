import type { FontSize } from '../store'
import type { Theme } from '@/app/theme'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { THEMES, useTheme } from '@/app/theme'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { selectFontSize, selectTrayEnabled, useSettingsStore } from '../store'
import { SettingsGroup, SettingsPage, SettingsRow } from '../ui'

const FONT_SIZES: readonly FontSize[] = [
  'small',
  'normal',
  'large',
  'extraLarge',
]

function useLaunchAtLogin(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = React.useState(false)

  React.useEffect(() => {
    let active = true
    isEnabled()
      .then((value) => {
        if (active)
          setEnabled(value)
      })
      .catch((error: unknown) => console.error('autostart isEnabled failed', error))
    return () => {
      active = false
    }
  }, [])

  const toggle = React.useCallback((next: boolean) => {
    setEnabled(next)
    const action = next
      ? enable()
      : disable()
    action.catch((error: unknown) => {
      console.error('changing autostart failed', error)
      setEnabled(!next)
    })
  }, [])

  return [enabled, toggle]
}

export function AppearanceSection() {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const { theme, setTheme } = useTheme()
  const fontSize = useSettingsStore(selectFontSize)
  const trayEnabled = useSettingsStore(selectTrayEnabled)
  const update = useSettingsStore(state => state.update)
  const [launchAtLogin, setLaunchAtLogin] = useLaunchAtLogin()

  return (
    <SettingsPage title={t('titles.appearance')}>
      <SettingsGroup title={t('appearance.theme')}>
        <RadioGroup
          aria-label={t('appearance.theme')}
          value={theme}
          onValueChange={value => setTheme(value as Theme)}
          className="px-1 py-2"
        >
          {THEMES.map(mode => (
            <Label key={mode}>
              <RadioGroupItem value={mode} aria-label={tCommon(`theme.${mode}`)} />
              {tCommon(`theme.${mode}`)}
            </Label>
          ))}
        </RadioGroup>
      </SettingsGroup>
      <SettingsGroup title={t('appearance.fontSize')}>
        <RadioGroup
          aria-label={t('appearance.fontSize')}
          value={fontSize}
          onValueChange={value => void update({ fontSize: value as FontSize })}
          className="px-1 py-2"
        >
          {FONT_SIZES.map(size => (
            <Label key={size}>
              <RadioGroupItem value={size} aria-label={t(`appearance.fontSizes.${size}`)} />
              {t(`appearance.fontSizes.${size}`)}
            </Label>
          ))}
        </RadioGroup>
      </SettingsGroup>
      <SettingsGroup title={t('appearance.system')}>
        <SettingsRow label={t('appearance.trayMode')} hint={t('appearance.trayModeHint')}>
          <Switch
            aria-label={t('appearance.trayMode')}
            checked={trayEnabled}
            onCheckedChange={next => void update({ trayEnabled: next })}
          />
        </SettingsRow>
        <SettingsRow label={t('appearance.launchAtLogin')} hint={t('appearance.launchAtLoginHint')}>
          <Switch
            aria-label={t('appearance.launchAtLogin')}
            checked={launchAtLogin}
            onCheckedChange={setLaunchAtLogin}
          />
        </SettingsRow>
      </SettingsGroup>
    </SettingsPage>
  )
}
