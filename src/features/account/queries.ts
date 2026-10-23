import { useQuery, useQueryClient } from '@tanstack/react-query'
import { session } from '@/lib/api'

export const sessionQueryKey = ['session'] as const

/** The persisted session, `null` without one. */
export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: session,
  })
}

/** Refetches the session after a change to the user's identity. */
export function useInvalidateSession() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: sessionQueryKey })
}
