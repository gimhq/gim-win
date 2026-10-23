import { invoke } from '@tauri-apps/api/core'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { ThemeProvider } from '@/app/theme'
import { i18n } from '@/i18n'
import enCommon from '@/i18n/locales/en/common.json'
import enSettings from '@/i18n/locales/en/settings.json'
import { DEFAULT_SETTINGS, useSettingsStore } from '../store'
import { AppearanceSection } from './appearance-section'

vi.mock('@tauri-apps/plugin-autostart', () => ({
  isEnabled: vi.fn(() => Promise.resolve(false)),
  enable: vi.fn(() => Promise.resolve()),
  disable: vi.fn(() => Promise.resolve()),
}))

const mockedInvoke = vi.mocked(invoke)
const mockedIsEnabled = vi.mocked(isEnabled)
const mockedEnable = vi.mocked(enable)
const mockedDisable = vi.mocked(disable)

function renderSection() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AppearanceSection />
      </ThemeProvider>
    </I18nextProvider>,
  )
}

beforeEach(() => {
  mockedInvoke.mockReset()
  mockedInvoke.mockResolvedValue(null)
  mockedIsEnabled.mockReset()
  mockedIsEnabled.mockResolvedValue(false)
  mockedEnable.mockReset()
  mockedEnable.mockResolvedValue(undefined)
  mockedDisable.mockReset()
  mockedDisable.mockResolvedValue(undefined)
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  document.documentElement.style.removeProperty('--app-font-size')
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, loaded: true })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('appearanceSection', () => {
  it('shows the title and the current theme', async () => {
    renderSection()
    expect(screen.getByRole('heading', { level: 1, name: enSettings.titles.appearance })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: enCommon.theme.system })).toBeChecked()
    expect(screen.getByRole('radio', { name: enSettings.appearance.fontSizes.normal })).toBeChecked()
    await waitFor(() => expect(mockedIsEnabled).toHaveBeenCalled())
  })

  it('switches the theme through the provider', () => {
    renderSection()
    fireEvent.click(screen.getByRole('radio', { name: enCommon.theme.dark }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('gim.theme')).toBe('dark')
    fireEvent.click(screen.getByRole('radio', { name: enCommon.theme.light }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('sets the text size and saves it', async () => {
    renderSection()
    fireEvent.click(screen.getByRole('radio', { name: enSettings.appearance.fontSizes.large }))
    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('18px')
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('settings_save', {
      settings: { ...DEFAULT_SETTINGS, fontSize: 'large' },
    }))
  })

  it('saves the tray mode', async () => {
    renderSection()
    const tray = screen.getByRole('switch', { name: enSettings.appearance.trayMode })
    expect(tray).toBeChecked()
    fireEvent.click(tray)
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('settings_save', {
      settings: { ...DEFAULT_SETTINGS, trayEnabled: false },
    }))
    expect(tray).not.toBeChecked()
  })

  it('reads and toggles launch at login', async () => {
    mockedIsEnabled.mockResolvedValue(true)
    renderSection()
    const launch = screen.getByRole('switch', { name: enSettings.appearance.launchAtLogin })
    await waitFor(() => expect(launch).toBeChecked())
    fireEvent.click(launch)
    await waitFor(() => expect(mockedDisable).toHaveBeenCalled())
    expect(launch).not.toBeChecked()
    fireEvent.click(launch)
    await waitFor(() => expect(mockedEnable).toHaveBeenCalled())
    expect(launch).toBeChecked()
  })

  it('reverts launch at login when enabling fails', async () => {
    mockedEnable.mockRejectedValue(new Error('denied'))
    renderSection()
    const launch = screen.getByRole('switch', { name: enSettings.appearance.launchAtLogin })
    await waitFor(() => expect(mockedIsEnabled).toHaveBeenCalled())
    fireEvent.click(launch)
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    await waitFor(() => expect(launch).not.toBeChecked())
  })
})
