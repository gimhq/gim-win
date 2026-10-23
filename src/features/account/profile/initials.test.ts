import { AVATAR_COLORS, avatarColor, initials } from './initials'

describe('initials', () => {
  it('takes the first letters of up to two words, uppercase', () => {
    expect(initials('roy smith')).toBe('RS')
    expect(initials('  Ada   Lovelace  King ')).toBe('AL')
  })

  it('uses a single character for one word', () => {
    expect(initials('roy')).toBe('R')
  })

  it('falls back to a question mark when empty', () => {
    expect(initials('')).toBe('?')
    expect(initials('   ')).toBe('?')
  })

  it('keeps characters outside the BMP whole', () => {
    expect(initials('😀 smile')).toBe('😀S')
  })
})

describe('avatarColor', () => {
  it('is stable for a user id', () => {
    expect(avatarColor('user-1')).toBe(avatarColor('user-1'))
  })

  it('picks one of the palette classes', () => {
    for (const id of ['a', 'user-1', 'user-2', 'f00ba7'])
      expect(AVATAR_COLORS).toContain(avatarColor(id))
  })

  it('spreads different ids over the palette', () => {
    const colors = new Set(Array.from({ length: 32 }, (_, i) => avatarColor(`user-${i}`)))
    expect(colors.size).toBeGreaterThan(1)
  })
})
