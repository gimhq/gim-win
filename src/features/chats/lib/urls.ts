/** Scheme, host (with optional port), then an optional path, query or fragment. */
const URL_PATTERN = /https?:\/\/[^\s/?#<>"'“”‘’][^\s<>"'“”‘’]*/gi
const TRAILING = /[.,;:!?)"'”’»]+$/

/** The first http(s) URL in `body`, without trailing punctuation; null when there is none. */
export function firstUrl(body: string): string | null {
  for (const [match] of body.matchAll(URL_PATTERN)) {
    const url = match.replace(TRAILING, '')
    if (/^https?:\/\/[^/?#]+/i.test(url))
      return url
  }
  return null
}
