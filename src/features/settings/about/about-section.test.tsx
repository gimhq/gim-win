import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { Providers } from '@/app/providers'
import enCommon from '@/i18n/locales/en/common.json'
import enSettings from '@/i18n/locales/en/settings.json'
import { version } from '../../../../package.json'
import { AboutSection } from './about-section'
import licences from './licences.json'

const mockedInvoke = vi.mocked(invoke)

function renderAbout() {
  render(
    <Providers>
      <AboutSection />
    </Providers>,
  )
}

beforeEach(() => {
  mockedInvoke.mockReset()
})

describe('about section', () => {
  it('shows the explainer, the app version and the core version', async () => {
    mockedInvoke.mockImplementation(async command => command === 'core_version'
      ? '1.2.3'
      : null)
    renderAbout()
    expect(screen.getByRole('heading', { level: 1, name: enSettings.titles.about })).toBeInTheDocument()
    expect(screen.getByText(enSettings.about.explainer.intro)).toBeInTheDocument()
    for (const key of [
      'noPhoneNumber',
      'onYourDevices',
      'lockedMessages',
      'accountId',
      'recoveryKey',
    ] as const)
      expect(screen.getByText(enSettings.about.explainer[key].title)).toBeInTheDocument()
    expect(screen.getByText(version)).toBeInTheDocument()
    expect(await screen.findByText('1.2.3')).toBeInTheDocument()
  })

  it('shows the generic error when the core version fails', async () => {
    mockedInvoke.mockImplementation(async (command) => {
      if (command === 'core_version')
        throw new Error('boom')
      return null
    })
    renderAbout()
    expect(await screen.findByText(enCommon.errors.generic)).toBeInTheDocument()
  })

  it('opens the licences list', async () => {
    renderAbout()
    fireEvent.click(screen.getByRole('button', { name: enSettings.about.licences }))
    expect(await screen.findByText(enSettings.about.licencesIntro)).toBeInTheDocument()
    const entry = licences[0]
    expect(screen.getByText(`${entry.name} ${entry.version} — ${entry.licence}`)).toBeInTheDocument()
  })
})
