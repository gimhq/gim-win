import { avatarColor, initials } from './avatar'

describe('initials', () => {
  it('takes the first letters of the first two words, upper-cased', () => {
    expect(initials('alice')).toBe('A')
    expect(initials('alice bob carol')).toBe('AB')
    expect(initials('  alice   bob ')).toBe('AB')
  })

  it('keeps whole graphemes', () => {
    expect(initials('👍🏽 party')).toBe('👍🏽P')
    expect(initials('éclair zeta')).toBe('ÉZ')
    expect(initials('张 三')).toBe('张三')
  })

  it('returns "?" for an empty name', () => {
    expect(initials('')).toBe('?')
    expect(initials('   ')).toBe('?')
  })
})

describe('avatarColor', () => {
  it('is stable for the same key', () => {
    expect(avatarColor('chat-1')).toBe(avatarColor('chat-1'))
  })

  it('stays in 0..7 and spreads across the range', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) {
      const color = avatarColor(`user-${i}`)
      expect(color).toBeGreaterThanOrEqual(0)
      expect(color).toBeLessThan(8)
      expect(Number.isInteger(color)).toBe(true)
      seen.add(color)
    }
    expect(seen.size).toBe(8)
  })
})
