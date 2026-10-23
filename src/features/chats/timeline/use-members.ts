import type { UserProfile } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { chatMembers } from '@/lib/api'
import { selectChat, useChatListStore } from '../store'

const NO_MEMBERS: UserProfile[] = []

/** The display name of `userId`, falling back to the first 8 chars of the id. */
export type NameOf = (userId: string) => string

/** The chat's members (loaded for group chats) and a name lookup over them and the direct peer. */
export function useMembers(chatId: string): { members: UserProfile[], nameOf: NameOf } {
  const chat = useChatListStore(selectChat(chatId))
  const query = useQuery({
    queryKey: ['chatMembers', chatId],
    queryFn: () => chatMembers(chatId),
    enabled: chat?.kind === 'Group',
  })
  const members = query.data ?? NO_MEMBERS
  const peer = chat?.peer ?? null

  const nameOf = React.useCallback<NameOf>((userId) => {
    const profile = peer?.userId === userId
      ? peer
      : members.find(member => member.userId === userId)
    return profile?.displayName || profile?.handle || userId.slice(0, 8)
  }, [members, peer])

  return { members, nameOf }
}
