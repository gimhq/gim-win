import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/i18n'
import enSettings from '@/i18n/locales/en/settings.json'
import { FLAGS } from '../flags'
import {
  BlockedUsersEntry,
  ChatControlsEntry,
  DeleteAccountEntry,
  ProfilePhotoEntry,
  ReadReceiptsSwitch,
  TypingIndicatorsSwitch,
} from './index'

vi.mock('../flags', () => ({
  FLAGS: { accountSafetyEntries: false },
}))

const mockedFlags = vi.mocked(FLAGS) as { accountSafetyEntries: boolean }

const ENTRIES = [
  {
    name: 'ProfilePhotoEntry',
    Component: ProfilePhotoEntry,
    labels: [enSettings.hidden.profilePhoto],
  },
  {
    name: 'ChatControlsEntry',
    Component: ChatControlsEntry,
    labels: [enSettings.hidden.mute, enSettings.hidden.pin, enSettings.hidden.archive],
  },
  {
    name: 'ReadReceiptsSwitch',
    Component: ReadReceiptsSwitch,
    labels: [enSettings.hidden.readReceipts],
  },
  {
    name: 'TypingIndicatorsSwitch',
    Component: TypingIndicatorsSwitch,
    labels: [enSettings.hidden.typingIndicators],
  },
  {
    name: 'BlockedUsersEntry',
    Component: BlockedUsersEntry,
    labels: [enSettings.hidden.blockedUsers],
  },
  {
    name: 'DeleteAccountEntry',
    Component: DeleteAccountEntry,
    labels: [enSettings.hidden.deleteAccount],
  },
]

function renderEntry(Component: () => React.ReactNode) {
  return render(
    <I18nextProvider i18n={i18n}>
      <Component />
    </I18nextProvider>,
  )
}

describe.each(ENTRIES)('$name', ({ Component, labels }) => {
  it('renders nothing while the flag is off', () => {
    mockedFlags.accountSafetyEntries = false
    const { container } = renderEntry(Component)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders its label when the flag is on', () => {
    mockedFlags.accountSafetyEntries = true
    renderEntry(Component)
    for (const label of labels)
      expect(screen.getByText(label)).toBeInTheDocument()
  })
})
