import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { copyText } from './desktop'

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn(() => Promise.resolve()),
}))

describe('copyText', () => {
  it('writes the text to the system clipboard', async () => {
    await copyText('gim-link-code')
    expect(vi.mocked(writeText)).toHaveBeenCalledWith('gim-link-code')
  })
})
