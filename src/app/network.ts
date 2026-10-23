import { setNetworkReachable } from '@/lib/api'

/**
 * Reports the browser's online state to the bridge now and on every change.
 * Command failures are logged; reachability reporting must never break the UI.
 */
export function installNetworkReporting(): () => void {
  const report = () => {
    setNetworkReachable(navigator.onLine).catch((error: unknown) => {
      console.error('set_network_reachable failed', error)
    })
  }
  report()
  window.addEventListener('online', report)
  window.addEventListener('offline', report)
  return () => {
    window.removeEventListener('online', report)
    window.removeEventListener('offline', report)
  }
}
