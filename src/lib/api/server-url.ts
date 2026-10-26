/**
 * The bridge's URL rule for the hub and the keep server (README, "Bridge
 * conventions"): `https://` with a host, or `http://` to a local host only.
 */

/** IPv4 loopback, private or link-local; IPv6 loopback, unique local or link-local. */
function isLocalIp(host: string): boolean | null {
  if (host.startsWith('[')) {
    const ip = host.slice(1, -1)
    if (ip === '::1')
      return true
    const first = Number.parseInt(ip.split(':')[0] || '0', 16)
    return (first & 0xFE00) === 0xFC00 || (first & 0xFFC0) === 0xFE80
  }
  const octets = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host)?.slice(1).map(Number)
  if (!octets)
    return null
  const [a, b] = octets
  return a === 10
    || a === 127
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)
}

/** localhost, a local IP, `*.local`, `*.lan` or a single label without a dot (dev containers). */
function isLocalHost(host: string): boolean {
  return isLocalIp(host)
    ?? (host === 'localhost' || host.endsWith('.local') || host.endsWith('.lan') || !host.includes('.'))
}

/** `https://` with a host, or `http://` to a local host. */
export function isAllowedServerUrl(value: string): boolean {
  const match = /^(https?):\/\/[^/]/.exec(value)
  if (!match || /\s/.test(value))
    return false
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    return false
  }
  if (url.hostname === '')
    return false
  return match[1] === 'https' || isLocalHost(url.hostname)
}
