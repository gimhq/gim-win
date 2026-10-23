import { firstUrl } from './urls'

describe('firstUrl', () => {
  it('returns the first http(s) URL', () => {
    expect(firstUrl('see https://example.com/a/b?c=1#d and http://other.org')).toBe('https://example.com/a/b?c=1#d')
    expect(firstUrl('http://example.com')).toBe('http://example.com')
    expect(firstUrl('HTTPS://Example.com/x')).toBe('HTTPS://Example.com/x')
  })

  it('keeps ports and paths', () => {
    expect(firstUrl('dev at http://localhost:8080/api now')).toBe('http://localhost:8080/api')
  })

  it('strips trailing punctuation and closing quotes', () => {
    expect(firstUrl('Go to https://example.com.')).toBe('https://example.com')
    expect(firstUrl('(https://example.com/a)')).toBe('https://example.com/a')
    expect(firstUrl('"https://example.com/a"')).toBe('https://example.com/a')
    expect(firstUrl('“https://example.com/a”')).toBe('https://example.com/a')
    expect(firstUrl('really https://example.com/a?!')).toBe('https://example.com/a')
    expect(firstUrl('list: https://a.com, https://b.com;')).toBe('https://a.com')
  })

  it('returns null without a URL', () => {
    expect(firstUrl('no links here')).toBeNull()
    expect(firstUrl('ftp://example.com')).toBeNull()
    expect(firstUrl('https://')).toBeNull()
    expect(firstUrl('')).toBeNull()
  })
})
