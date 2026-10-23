import { invoke } from '@tauri-apps/api/core'
import { i18n, setLanguage } from '@/i18n'
import { syncTrayLabels } from './tray-labels'

const mockedInvoke = vi.mocked(invoke)

beforeEach(async () => {
  await setLanguage('en')
  mockedInvoke.mockReset()
  mockedInvoke.mockResolvedValue(null)
})

afterAll(async () => {
  await setLanguage('en')
})

describe('syncTrayLabels', () => {
  it('sets the labels now and on every language change', async () => {
    const cleanup = syncTrayLabels(i18n)
    expect(mockedInvoke).toHaveBeenLastCalledWith('set_tray_labels', { show: 'Show', hide: 'Hide', quit: 'Quit' })

    await setLanguage('es')
    expect(mockedInvoke).toHaveBeenCalledTimes(2)
    expect(mockedInvoke).toHaveBeenLastCalledWith('set_tray_labels', { show: 'Mostrar', hide: 'Ocultar', quit: 'Salir' })

    cleanup()
    await setLanguage('en')
    expect(mockedInvoke).toHaveBeenCalledTimes(2)
  })
})
