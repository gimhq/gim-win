import { NAMESPACES, SUPPORTED_LANGUAGES } from './resources'

type Tree = Record<string, unknown>

// Every locale JSON, keyed by "<language>/<namespace>".
const files = import.meta.glob<{ default: Tree }>('./locales/*/*.json', { eager: true })

function fileFor(language: string, namespace: string): Tree | undefined {
  return files[`./locales/${language}/${namespace}.json`]?.default
}

function flatten(tree: Tree, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix
      ? `${prefix}.${key}`
      : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value))
      Object.assign(out, flatten(value as Tree, path))
    else
      out[path] = value
  }
  return out
}

describe('locale completeness', () => {
  it('every language has every namespace', () => {
    const missing = SUPPORTED_LANGUAGES.flatMap(language =>
      NAMESPACES.filter(namespace => !fileFor(language, namespace)).map(namespace => `${language}/${namespace}`),
    )
    expect(missing, `missing locale files: ${missing.join(', ')}`).toEqual([])
  })

  it('no unexpected locale files exist', () => {
    const expected = new Set(
      SUPPORTED_LANGUAGES.flatMap(language => NAMESPACES.map(namespace => `./locales/${language}/${namespace}.json`)),
    )
    const extra = Object.keys(files).filter(path => !expected.has(path))
    expect(extra, `locale files outside SUPPORTED_LANGUAGES or NAMESPACES: ${extra.join(', ')}`).toEqual([])
  })

  describe.each(NAMESPACES)('namespace %s', (namespace) => {
    const reference = Object.keys(flatten(fileFor('en', namespace) ?? {})).sort()

    it.each(SUPPORTED_LANGUAGES.filter(language => language !== 'en'))('%s has the same keys as en', (language) => {
      const keys = Object.keys(flatten(fileFor(language, namespace) ?? {})).sort()
      const missing = reference.filter(key => !keys.includes(key))
      const extra = keys.filter(key => !reference.includes(key))
      expect(
        { missing, extra },
        `${language}/${namespace}: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`,
      ).toEqual({ missing: [], extra: [] })
    })

    it.each(SUPPORTED_LANGUAGES)('%s has no empty or non-string values', (language) => {
      const flat = flatten(fileFor(language, namespace) ?? {})
      const bad = Object.entries(flat)
        .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
        .map(([key]) => key)
      expect(bad, `${language}/${namespace}: empty values at [${bad.join(', ')}]`).toEqual([])
    })
  })
})
