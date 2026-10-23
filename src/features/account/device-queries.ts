import { useQuery, useQueryClient } from '@tanstack/react-query'
import { devices } from '@/lib/api'

export const devicesQueryKey = ['devices'] as const

/** The user's own devices, revoked ones included. */
export function useDevices() {
  return useQuery({
    queryKey: devicesQueryKey,
    queryFn: devices,
  })
}

export function useInvalidateDevices() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: devicesQueryKey })
}
