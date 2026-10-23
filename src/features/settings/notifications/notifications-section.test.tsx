import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/i18n'
import enSettings from '@/i18n/locales/en/settings.json'
import { DEFAULT_SETTINGS, useSettingsStore } from '../store'
import { NotificationsSection } from './notifications-section'

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(() => Promise.resolve()),
}))

const mockedInvoke = vi.mocked(invoke)
const mockedOpenUrl = vi.mocked(openUrl)

function renderSection() {
  return render(
    <I18nextProvider i18n={i18n}>
      <NotificationsSection />
    </I18nextProvider>,
  )
}

beforeEach(() => {
  mockedInvoke.mockReset()
  mockedInvoke.mockResolvedValue(null)
  mockedOpenUrl.mockClear()
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, loaded: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('notificationsSection', () => {
  it('shows the title and switches reflecting the store', () => {
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        notifications: { enabled: true, sound: false, showText: true },
      },
    })
    renderSection()
    expect(screen.getByRole('heading', { level: 1, name: enSettings.titles.notifications })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: enSettings.notifications.enabled })).toBeChecked()
    expect(screen.getByRole('switch', { name: enSettings.notifications.sound })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: enSettings.notifications.showText })).toBeChecked()
  })

  it('saves the merged settings when a switch is toggled', async () => {
    renderSection()
    fireEvent.click(screen.getByRole('switch', { name: enSettings.notifications.sound }))
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('settings_save', {
      settings: {
        ...DEFAULT_SETTINGS,
        notifications: { enabled: true, sound: false, showText: true },
      },
    }))
    expect(screen.getByRole('switch', { name: enSettings.notifications.sound })).not.toBeChecked()
  })

  it('disables sound and text while notifications are off', async () => {
    renderSection()
    fireEvent.click(screen.getByRole('switch', { name: enSettings.notifications.enabled }))
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith('settings_save', {
      settings: {
        ...DEFAULT_SETTINGS,
        notifications: { enabled: false, sound: true, showText: true },
      },
    }))
    expect(screen.getByRole('switch', { name: enSettings.notifications.sound })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('switch', { name: enSettings.notifications.showText })).toHaveAttribute('aria-disabled', 'true')
  })

  it('disables the system settings button off Windows', () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })
    renderSection()
    const button = screen.getByRole('button', { name: enSettings.notifications.openSystem })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(mockedOpenUrl).not.toHaveBeenCalled()
  })

  it('opens the Windows notification settings on Windows', () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })
    renderSection()
    fireEvent.click(screen.getByRole('button', { name: enSettings.notifications.openSystem }))
    expect(mockedOpenUrl).toHaveBeenCalledWith('ms-settings:notifications')
  })
})
