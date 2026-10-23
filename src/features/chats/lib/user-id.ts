/**
 * "u" + 55 symbols of lowercase base32, the last one carrying 3 zero bits:
 * the shape of a user id, as gim-sdk's `is_user_id`.
 */
const USER_ID = /^u[a-z2-7]{54}[aiqy]$/

export function isUserId(token: string): boolean {
  return USER_ID.test(token)
}

/**
 * The first user id in pasted or scanned text (New chat paste, QR codes):
 * the text is split on anything that is not a letter or digit, so quotes and
 * surrounding words are ignored but a longer alphanumeric run never matches.
 */
export function extractUserId(text: string): string | null {
  for (const token of text.trim().split(/[^a-z0-9]+/i)) {
    if (isUserId(token))
      return token
  }
  return null
}
