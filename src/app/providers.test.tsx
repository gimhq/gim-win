import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { Providers } from './providers'
import { routeTree } from './routeTree.gen'

describe('providers', () => {
  it('renders the index placeholder', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
    })
    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    )
    expect(await screen.findByText('gim')).toBeInTheDocument()
  })
})
