import { createRouter, RouterProvider } from '@tanstack/react-router'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from './providers'
import { routeTree } from './routeTree.gen'
import '../index.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <React.StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </React.StrictMode>,
)
