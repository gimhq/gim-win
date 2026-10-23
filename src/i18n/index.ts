import type { Language } from './resources'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { NAMESPACES, resources, SUPPORTED_LANGUAGES } from './resources'

export { type Language, type Namespace, NAMESPACES, resources, SUPPORTED_LANGUAGES } from './resources'

export const LANGUAGE_STORAGE_KEY = 'gim.language'

/** Each language in its own words; `common:languages.*` holds the same names. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  'en': 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'es': 'Español',
}

function isSupported(value: string | null): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language)
}

/** Maps a BCP 47 tag to a supported language; anything unknown falls back to English. */
export function mapLanguageTag(tag: string): Language {
  const lower = tag.toLowerCase()
  if (lower.startsWith('zh')) {
    const traditional = ['zh-tw', 'zh-hk', 'zh-mo'].some(prefix => lower.startsWith(prefix)) || lower.includes('hant')
    return traditional ? 'zh-TW' : 'zh-CN'
  }
  if (lower === 'es' || lower.startsWith('es-'))
    return 'es'
  return 'en'
}

/** The persisted language if set, else the system language mapped to a supported one. */
export function detectLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (isSupported(stored))
    return stored
  return mapLanguageTag(navigator.language ?? 'en')
}

export const i18n = i18next.createInstance()

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  ns: NAMESPACES,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  // Static resources: the instance is ready synchronously.
  initAsync: false,
})
document.documentElement.lang = i18n.language

/** Changes the active language, persists it and updates `<html lang>`. */
export async function setLanguage(lang: Language): Promise<void> {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  await i18n.changeLanguage(lang)
  document.documentElement.lang = lang
}

export default i18n
