import type { LinkPreview } from '@/lib/api'
import { openUrl } from '@tauri-apps/plugin-opener'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import enChat from '@/i18n/locales/en/chat.json'
import { LinkPreviewCard } from './link-preview-card'
import { callsOf, renderWithChats } from './test-render'

vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: vi.fn(() => Promise.resolve()),
  openUrl: vi.fn(() => Promise.resolve()),
}))

const URL = 'https://example.com/post'

const preview: LinkPreview = {
  url: URL,
  finalUrl: URL,
  title: 'A post',
  description: 'What it is about',
  imageUrl: 'https://example.com/cover.png',
  siteName: 'Example',
}

describe('link preview card', () => {
  it('renders the site, title, description and image and opens the URL', async () => {
    renderWithChats(<LinkPreviewCard body={`look ${URL}.`} />, [], {
      fetch_link_preview: () => preview,
    })
    expect(screen.getByLabelText(enChat.preview.loading)).toBeInTheDocument()
    expect(await screen.findByText('A post')).toBeInTheDocument()
    expect(screen.getByText('Example')).toBeInTheDocument()
    expect(screen.getByText('What it is about')).toBeInTheDocument()
    const image = document.querySelector('img')!
    expect(image).toHaveAttribute('src', 'https://example.com/cover.png')
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(callsOf('fetch_link_preview')).toEqual([
      { url: URL },
    ])

    fireEvent.click(screen.getByRole('button', { name: /A post/ }))
    expect(openUrl).toHaveBeenCalledWith(URL)

    fireEvent.error(image)
    expect(document.querySelector('img')).toBeNull()
  })

  it('hides an image that is not http(s) or fails to load', async () => {
    renderWithChats(<LinkPreviewCard body={URL} />, [], {
      fetch_link_preview: () => ({ ...preview, imageUrl: 'file:///etc/passwd' }),
    })
    expect(await screen.findByText('A post')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })

  it('renders nothing for a null preview or a body without a URL', async () => {
    const { container } = renderWithChats(<LinkPreviewCard body={URL} />, [], {
      fetch_link_preview: () => null,
    })
    await waitFor(() => expect(screen.queryByLabelText(enChat.preview.loading)).not.toBeInTheDocument())
    expect(container).toBeEmptyDOMElement()

    const other = renderWithChats(<LinkPreviewCard body="no link here" />, [])
    expect(other.container).toBeEmptyDOMElement()
  })
})
