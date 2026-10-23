import { SUPPORTED_LANGUAGES } from '@/i18n/resources'

type Tree = Record<string, unknown>

const files = import.meta.glob<{ default: Tree }>('@/i18n/locales/*/chat.json', { eager: true })

function chatFor(language: string): Tree {
  const entry = Object.entries(files).find(([path]) => path.endsWith(`/locales/${language}/chat.json`))
  return entry?.[1].default ?? {}
}

const BLOCKS = [
  'list',
  'newChat',
  'pane',
  'actions',
  'members',
  'composer',
  'media',
  'preview',
  'search',
  'shortcuts',
  'errors',
]

describe('chat namespace', () => {
  it.each(SUPPORTED_LANGUAGES)('%s has every chat block', (language) => {
    const chat = chatFor(language)
    const missing = BLOCKS.filter(block => typeof chat[block] !== 'object' || chat[block] === null)
    expect(missing, `${language}/chat: missing blocks [${missing.join(', ')}]`).toEqual([])
  })

  it.each(SUPPORTED_LANGUAGES)('%s keeps the placeholders of pane.membership.added', (language) => {
    const pane = chatFor(language).pane as { membership?: { added?: string } } | undefined
    const added = pane?.membership?.added ?? ''
    expect(added).toContain('{{name}}')
    expect(added).toContain('{{actor}}')
  })
})
