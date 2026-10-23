import { extractUserId, isUserId } from './user-id'

const VALID = `u${'a'.repeat(27)}${'234567'.repeat(4)}abcq`

describe('isUserId', () => {
  it('accepts the user id shape', () => {
    expect(VALID).toHaveLength(56)
    expect(isUserId(VALID)).toBe(true)
    for (const last of ['a', 'i', 'q', 'y'])
      expect(isUserId(VALID.slice(0, 55) + last)).toBe(true)
  })

  it('rejects a wrong length', () => {
    expect(isUserId(VALID.slice(0, 55))).toBe(false)
    expect(isUserId(`${VALID}a`)).toBe(false)
    expect(isUserId('')).toBe(false)
  })

  it('rejects a wrong last symbol', () => {
    expect(isUserId(`${VALID.slice(0, 55)}b`)).toBe(false)
  })

  it('rejects a wrong prefix or symbols outside base32', () => {
    expect(isUserId(`v${VALID.slice(1)}`)).toBe(false)
    expect(isUserId(`${VALID.slice(0, 10)}8${VALID.slice(11)}`)).toBe(false)
    expect(isUserId(VALID.toUpperCase())).toBe(false)
  })
})

describe('extractUserId', () => {
  it('returns a bare id, trimmed', () => {
    expect(extractUserId(`  ${VALID}\n`)).toBe(VALID)
  })

  it('finds the id inside a sentence', () => {
    expect(extractUserId(`Add me: ${VALID}, thanks!`)).toBe(VALID)
  })

  it('strips surrounding quotes', () => {
    expect(extractUserId(`"${VALID}"`)).toBe(VALID)
    expect(extractUserId(`'${VALID}'`)).toBe(VALID)
    expect(extractUserId(`“${VALID}”`)).toBe(VALID)
  })

  it('returns the first match', () => {
    const other = `${VALID.slice(0, 55)}y`
    expect(extractUserId(`${other} ${VALID}`)).toBe(other)
  })

  it('returns null without a valid id', () => {
    expect(extractUserId('hello world')).toBeNull()
    expect(extractUserId(`${VALID}x`)).toBeNull()
    expect(extractUserId(`${VALID.slice(0, 55)}b`)).toBeNull()
    expect(extractUserId('')).toBeNull()
  })
})
