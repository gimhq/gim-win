import { invoke } from '@tauri-apps/api/core'
import { prepareMediaDir, stageAttachment } from './staging'

vi.mock('@tauri-apps/api/core')

const mockedInvoke = vi.mocked(invoke)

beforeEach(() => {
  mockedInvoke.mockReset()
})

describe('staging', () => {
  it('stageAttachment passes the bytes as an array and returns the path', async () => {
    mockedInvoke.mockResolvedValueOnce('/cache/staging/a.png')
    await expect(stageAttachment(new Uint8Array([1, 2, 3]), 'png')).resolves.toBe('/cache/staging/a.png')
    expect(mockedInvoke).toHaveBeenCalledWith('stage_attachment', {
      bytes: [1, 2, 3],
      extension: 'png',
    })
  })

  it('prepareMediaDir passes the chat id and returns the directory', async () => {
    mockedInvoke.mockResolvedValueOnce('/cache/media/c1')
    await expect(prepareMediaDir('c1')).resolves.toBe('/cache/media/c1')
    expect(mockedInvoke).toHaveBeenCalledWith('prepare_media_dir', { chatId: 'c1' })
  })

  it('wraps a non-GimError rejection as Internal', async () => {
    mockedInvoke.mockRejectedValueOnce('boom')
    await expect(stageAttachment(new Uint8Array(), 'png')).rejects.toEqual({
      kind: 'Internal',
      message: 'boom',
      reason: 'boom',
    })
  })
})
