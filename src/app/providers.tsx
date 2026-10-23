import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/i18n'
import { installNetworkReporting } from './network'
import { ThemeProvider } from './theme'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: import.meta.env.MODE === 'test'
          ? false
          : 3,
      },
    },
  })
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = React.useState(createQueryClient)

  React.useEffect(() => installNetworkReporting(), [])

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}
