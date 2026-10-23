import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { Providers } from '@/app/providers'
import { routeTree } from '@/app/routeTree.gen'
import en from '@/i18n/locales/en/onboarding.json'
import { INTRO_SEEN_KEY } from './welcome'

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [path],
    }),
  })
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
  return router
}

beforeEach(() => {
  vi.mocked(invoke).mockReset()
  sessionStorage.clear()
})

describe('welcome', () => {
  it('advances through the intro pages to the choice', async () => {
    renderAt('/onboarding')
    expect(await screen.findByRole('heading', { level: 1, name: en.titles.welcome })).toBeInTheDocument()
    expect(screen.getByText(en.intro.noPhone.title)).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(en.intro.onYourDevices.title)).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(en.intro.lockedMessages.title)).toBeInTheDocument()
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: en.intro.start }))
    expect(screen.getByText(en.welcome.explanation)).toBeInTheDocument()
    expect(sessionStorage.getItem(INTRO_SEEN_KEY)).toBe('1')
  })

  it('lists the three options with link first', async () => {
    renderAt('/onboarding')
    fireEvent.click(await screen.findByRole('button', { name: en.intro.skip }))
    const links = screen.getAllByRole('link')
    expect(links.map(link => link.textContent)).toEqual([
      en.welcome.link,
      en.welcome.create,
      en.welcome.restore,
    ])
    expect(links[0]).toHaveAttribute('href', '/onboarding/link')
    expect(links[1]).toHaveAttribute('href', '/onboarding/create')
    expect(links[2]).toHaveAttribute('href', '/onboarding/restore')
  })

  it('lands on the choice once the intro was seen', async () => {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    renderAt('/onboarding')
    expect(await screen.findByRole('link', { name: en.welcome.link })).toBeInTheDocument()
    expect(screen.queryByText(en.intro.noPhone.title)).not.toBeInTheDocument()
  })
})
