import esSettings from '@/i18n/locales/es/settings.json'
import { formatDate } from '@/lib/format'
import { detectLanguage, i18n, LANGUAGE_NAMES, LANGUAGE_STORAGE_KEY, setLanguage, SUPPORTED_LANGUAGES } from './index'

afterEach(async () => {
  await setLanguage('en')
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('setLanguage', () => {
  it('switches formatting, copy and the document language at once', async () => {
    await setLanguage('es')
    expect(i18n.language).toBe('es')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es')
    expect(document.documentElement.lang).toBe('es')
    expect(formatDate(Date.UTC(2026, 0, 15, 12))).toMatch(/ene/)
    expect(i18n.t('settings:titles.language')).toBe(esSettings.titles.language)
  })
})

describe('detectLanguage', () => {
  it('falls back to English for an unsupported system language', () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'fr-FR' })
    expect(detectLanguage()).toBe('en')
  })

  it('prefers the stored choice over the system language', () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'fr-FR' })
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'zh-CN')
    expect(detectLanguage()).toBe('zh-CN')
  })
})

describe('lANGUAGE_NAMES', () => {
  it('names every supported language', () => {
    expect(Object.keys(LANGUAGE_NAMES).sort()).toEqual([...SUPPORTED_LANGUAGES].sort())
  })
})
