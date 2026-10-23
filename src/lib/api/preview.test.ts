import type { LinkPreview } from './preview'
import { invoke } from '@tauri-apps/api/core'
import { fetchLinkPreview } from './preview'

vi.mock('@tauri-apps/api/core')

const mockedInvoke = vi.mocked(invoke)

beforeEach(() => {
  mockedInvoke.mockReset()
})

describe('preview', () => {
  it('fetchLinkPreview passes the url and returns the preview', async () => {
    const preview: LinkPreview = {
      url: 'https://example.com',
      finalUrl: 'https://www.example.com/',
      title: 'Example',
      description: null,
      imageUrl: null,
      siteName: 'example.com',
    }
    mockedInvoke.mockResolvedValueOnce(preview)
    await expect(fetchLinkPreview('https://example.com')).resolves.toEqual(preview)
    expect(mockedInvoke).toHaveBeenCalledWith('fetch_link_preview', { url: 'https://example.com' })
  })

  it('fetchLinkPreview returns null when there is no preview', async () => {
    mockedInvoke.mockResolvedValueOnce(null)
    await expect(fetchLinkPreview('ftp://x')).resolves.toBeNull()
  })

  it('wraps a non-GimError rejection as Internal', async () => {
    mockedInvoke.mockRejectedValueOnce('boom')
    await expect(fetchLinkPreview('https://example.com')).rejects.toEqual({
      kind: 'Internal',
      message: 'boom',
      reason: 'boom',
    })
  })
})
