import { startSync } from '@/lib/api'

// Start-once latch per app lifetime: set while `start_sync` runs or after it succeeded.
let started: Promise<void> | null = null

/**
 * Starts sync unless it is already running or started. A failed start is
 * logged and clears the latch so the next call retries; it never throws.
 */
export function ensureSyncStarted(): Promise<void> {
  started ??= startSync().catch((error: unknown) => {
    console.error('start_sync failed', error)
    started = null
  })
  return started
}

/** Sign-out path: the bridge stopped sync, so the next session starts it again. */
export function markSyncStopped(): void {
  started = null
}

export function resetSyncForTests(): void {
  started = null
}
