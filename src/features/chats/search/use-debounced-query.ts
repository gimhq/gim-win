import * as React from 'react'

const DEBOUNCE_MS = 150

/** `query` trimmed, once it has not changed for 150 ms. */
export function useDebouncedQuery(query: string): string {
  const [debounced, setDebounced] = React.useState(query.trim())
  React.useEffect(() => {
    const timer = setTimeout(setDebounced, DEBOUNCE_MS, query.trim())
    return () => clearTimeout(timer)
  }, [query])
  return debounced
}
