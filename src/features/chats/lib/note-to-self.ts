import { createDirectChat, session } from '@/lib/api'

/** Creates the note to self, or returns it when it exists: the direct chat with the own user id. */
export async function openNoteToSelf(): Promise<string> {
  const current = await session()
  if (!current)
    throw new Error('no session')
  return createDirectChat(current.userId)
}
