import { isGimError } from '@/lib/api'

/** The `chat` key of the `errors.*` copy for a failed chat action. */
export function errorKey(error: unknown): string {
  if (!isGimError(error))
    return 'errors.generic'
  switch (error.kind) {
    case 'ChatNotActive':
      return 'errors.chatNotActive'
    case 'Network':
      return 'errors.offline'
    default:
      return 'errors.generic'
  }
}
