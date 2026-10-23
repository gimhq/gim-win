import type { MessageContent } from '@/lib/api'
import { save } from '@tauri-apps/plugin-dialog'
import { openPath } from '@tauri-apps/plugin-opener'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import enChat from '@/i18n/locales/en/chat.json'
import { FileContent } from './file-content'
import { ImageContent } from './image-content'
import { callsOf, chat, renderWithChats } from './test-render'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
  convertFileSrc: (path: string) => `asset://${path}`,
}))
vi.mock('@tauri-apps/api/path', () => ({
  appCacheDir: () => Promise.resolve('/cache'),
  join: (...parts: string[]) => Promise.resolve(parts.join('/')),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}))
vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: vi.fn(() => Promise.resolve()),
  openUrl: vi.fn(() => Promise.resolve()),
}))

const CHAT_ID = 'c1'

const image: Extract<MessageContent, { type: 'Image' }> = {
  type: 'Image',
  media: {
    chatId: CHAT_ID,
    messageId: 'm1',
    mime: 'image/png',
    size: 2048,
    hasThumbnail: true,
  },
  width: 1280,
  height: 640,
  caption: 'sunset',
}

const file: Extract<MessageContent, { type: 'File' }> = {
  type: 'File',
  media: {
    chatId: CHAT_ID,
    messageId: 'm2',
    mime: 'application/pdf',
    size: 1536,
    hasThumbnail: false,
  },
  fileName: 'report.pdf',
  caption: null,
}

describe('image content', () => {
  it('fetches the thumbnail once into the cache and sizes it within 320x320', async () => {
    const { rerender } = renderWithChats(<ImageContent content={image} />, [
      chat(CHAT_ID),
    ], {
      fetch_thumbnail: args => args?.destPath,
    })
    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'asset:///cache/media/c1/m1.thumb')
    expect(img.parentElement).toHaveStyle({ width: '320px', height: '160px' })
    rerender(<ImageContent content={{ ...image, caption: 'sunset again' }} />)
    expect(callsOf('fetch_thumbnail')).toEqual([
      { chatId: CHAT_ID, messageId: 'm1', destPath: '/cache/media/c1/m1.thumb' },
    ])
    expect(screen.getByText('sunset again')).toBeInTheDocument()
  })

  it('does not fetch a thumbnail the media does not have', () => {
    renderWithChats(
      <ImageContent content={{
        ...image,
        media: { ...image.media, hasThumbnail: false },
      }}
      />,
      [
        chat(CHAT_ID),
      ],
    )
    expect(callsOf('fetch_thumbnail')).toEqual([])
  })

  it('opens the full image in the viewer', async () => {
    renderWithChats(<ImageContent content={image} />, [
      chat(CHAT_ID),
    ], {
      fetch_thumbnail: args => args?.destPath,
      fetch_media: args => args?.destPath,
    })
    fireEvent.click(await screen.findByRole('button', { name: enChat.media.view }))
    const full = await screen.findByRole('img', { name: 'sunset' })
    expect(full).toHaveAttribute('src', 'asset:///cache/media/c1/m1.png')
    expect(callsOf('fetch_media')).toEqual([
      { chatId: CHAT_ID, messageId: 'm1', destPath: '/cache/media/c1/m1.png' },
    ])
  })

  it('shows a retry when the full image fails', async () => {
    let fail = true
    renderWithChats(<ImageContent content={image} />, [
      chat(CHAT_ID),
    ], {
      fetch_media: (args) => {
        if (fail)
          // eslint-disable-next-line no-throw-literal -- the bridge rejects with a plain GimError object
          throw { kind: 'Network', message: 'down', reason: 'down' }
        return args?.destPath
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: enChat.media.view }))
    expect(await screen.findByText(enChat.media.failed)).toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('img', { name: 'sunset' })).toBeInTheDocument()
  })
})

describe('file content', () => {
  it('shows the name and size and downloads then opens the file', async () => {
    renderWithChats(<FileContent content={file} />, [
      chat(CHAT_ID),
    ], {
      fetch_media: args => args?.destPath,
    })
    expect(screen.getByText('report.pdf')).toBeInTheDocument()
    expect(screen.getByText('2 KB')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: enChat.media.download }))
    await waitFor(() => expect(openPath).toHaveBeenCalledWith('/cache/media/c1/m2.pdf'))
    expect(callsOf('fetch_media')).toEqual([
      { chatId: CHAT_ID, messageId: 'm2', destPath: '/cache/media/c1/m2.pdf' },
    ])
  })

  it('saves to the chosen path', async () => {
    vi.mocked(save).mockResolvedValueOnce('D:\\Downloads\\report.pdf')
    renderWithChats(<FileContent content={file} />, [
      chat(CHAT_ID),
    ], {
      fetch_media: args => args?.destPath,
    })
    fireEvent.click(screen.getByRole('button', { name: enChat.media.saveAs }))
    await waitFor(() => expect(callsOf('fetch_media')).toEqual([
      { chatId: CHAT_ID, messageId: 'm2', destPath: 'D:\\Downloads\\report.pdf' },
    ]))
    expect(save).toHaveBeenCalledWith({ defaultPath: 'report.pdf' })
  })

  it('shows the failure', async () => {
    renderWithChats(<FileContent content={file} />, [
      chat(CHAT_ID),
    ], {
      fetch_media: () => {
        // eslint-disable-next-line no-throw-literal -- the bridge rejects with a plain GimError object
        throw { kind: 'Network', message: 'down', reason: 'down' }
      },
    })
    fireEvent.click(screen.getByRole('button', { name: enChat.media.download }))
    expect(await screen.findByText(enChat.media.failed)).toBeInTheDocument()
  })
})
