import enAccount from './locales/en/account.json'
import enChat from './locales/en/chat.json'
import enCommon from './locales/en/common.json'
import enOnboarding from './locales/en/onboarding.json'
import enSettings from './locales/en/settings.json'
import esAccount from './locales/es/account.json'
import esChat from './locales/es/chat.json'
import esCommon from './locales/es/common.json'
import esOnboarding from './locales/es/onboarding.json'
import esSettings from './locales/es/settings.json'
import zhCNAccount from './locales/zh-CN/account.json'
import zhCNChat from './locales/zh-CN/chat.json'
import zhCNCommon from './locales/zh-CN/common.json'
import zhCNOnboarding from './locales/zh-CN/onboarding.json'
import zhCNSettings from './locales/zh-CN/settings.json'
import zhTWAccount from './locales/zh-TW/account.json'
import zhTWChat from './locales/zh-TW/chat.json'
import zhTWCommon from './locales/zh-TW/common.json'
import zhTWOnboarding from './locales/zh-TW/onboarding.json'
import zhTWSettings from './locales/zh-TW/settings.json'

export const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'zh-TW', 'es'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const NAMESPACES = [
  'common',
  'onboarding',
  'account',
  'chat',
  'settings',
] as const
export type Namespace = (typeof NAMESPACES)[number]

export const resources = {
  'en': {
    common: enCommon,
    onboarding: enOnboarding,
    account: enAccount,
    chat: enChat,
    settings: enSettings,
  },
  'zh-CN': {
    common: zhCNCommon,
    onboarding: zhCNOnboarding,
    account: zhCNAccount,
    chat: zhCNChat,
    settings: zhCNSettings,
  },
  'zh-TW': {
    common: zhTWCommon,
    onboarding: zhTWOnboarding,
    account: zhTWAccount,
    chat: zhTWChat,
    settings: zhTWSettings,
  },
  'es': {
    common: esCommon,
    onboarding: esOnboarding,
    account: esAccount,
    chat: esChat,
    settings: esSettings,
  },
} as const satisfies Record<Language, Record<Namespace, object>>
