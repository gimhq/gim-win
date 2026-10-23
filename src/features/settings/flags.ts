/**
 * Feature flags of the settings area.
 *
 * `accountSafetyEntries` (C7) hides the entries whose SDK support is not
 * surfaced on this platform yet: profile photo, chat controls (mute, pin,
 * archive), read receipts, typing indicators, blocked users and delete
 * account. Flip it to show them; nothing else is gated by it.
 */
export const FLAGS = { accountSafetyEntries: false } as const
