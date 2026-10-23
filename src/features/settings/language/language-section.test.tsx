import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n, setLanguage } from '@/i18n'
import enCommon from '@/i18n/locales/en/common.json'
import enSettings from '@/i18n/locales/en/settings.json'
import esSettings from '@/i18n/locales/es/settings.json'
import zhTWSettings from '@/i18n/locales/zh-TW/settings.json'
import { LanguageSection } from './language-section'

function renderSection() {
  return render(
    <I18nextProvider i18n={i18n}>
      <LanguageSection />
    </I18nextProvider>,
  )
}

beforeEach(async () => {
  await setLanguage('en')
  localStorage.clear()
})

afterEach(async () => {
  await setLanguage('en')
  localStorage.clear()
})

describe('languageSection', () => {
  it('lists every language by its own name with the current one checked', () => {
    renderSection()
    expect(screen.getByRole('heading', { level: 1, name: enSettings.titles.language })).toBeInTheDocument()
    expect(screen.getByText(enSettings.language.hint)).toBeInTheDocument()
    for (const name of Object.values(enCommon.languages))
      expect(screen.getByRole('radio', { name })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: enCommon.languages.en })).toBeChecked()
  })

  it('switches the UI language at once and persists it', async () => {
    renderSection()
    fireEvent.click(screen.getByRole('radio', { name: enCommon.languages.es }))
    expect(await screen.findByRole('heading', { level: 1, name: esSettings.titles.language })).toBeInTheDocument()
    expect(localStorage.getItem('gim.language')).toBe('es')
    expect(screen.getByRole('radio', { name: enCommon.languages.es })).toBeChecked()

    fireEvent.click(screen.getByRole('radio', { name: enCommon.languages['zh-TW'] }))
    expect(await screen.findByRole('heading', { level: 1, name: zhTWSettings.titles.language })).toBeInTheDocument()
    expect(localStorage.getItem('gim.language')).toBe('zh-TW')
  })
})
