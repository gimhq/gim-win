/**
 * Records and enums of the Rust bridge, field for field as gim-ffi serialises
 * them: camelCase keys, `null` for absent optionals, unit enums as the variant
 * name, data-carrying enums internally tagged with `type`. Timestamps are
 * Unix milliseconds. See gim-client-sdk `docs/API.md`.
 */

import type { GimError } from './errors'

export interface Session {
  userId: string
  deviceId: string
  /** Empty until `claimHandle`. */
  handle: string
  displayName: string
}

export interface RecoveryRotation {
  recoveryCode: string
  /** The old code keeps working on these hubs until a later rotation reaches them. */
  unsyncedHubIds: string[]
}

export interface DeviceInfo {
  deviceId: string
  /** When the device was certified; 0 for revoked devices. */
  createdAtMs: number
  isCurrent: boolean
  revoked: boolean
}

export interface UserProfile {
  userId: string
  handle: string
  displayName: string
  hasAvatar: boolean
}

export type HubState = 'Unverified' | 'Verified' | 'Removed'

export interface HubInfo {
  hubId: string
  /** Client API base URL, once known. */
  url: string | null
  state: HubState
  /** Lower is preferred. */
  priority: number
  isPrimary: boolean
  isHome: boolean
  signedIn: boolean
}

/** `Offline` until `startSync`; `Connecting` -> `Syncing` -> `Connected`. */
export type ConnectionState = 'Offline' | 'Connecting' | 'Connected' | 'Syncing'

export type ChatKind = 'Direct' | 'Group'

export type ChatState = 'Active' | 'Leaving' | 'Left'

export interface MessagePreview {
  senderName: string
  text: string
  sentAtMs: number
  isOwn: boolean
  /** Own messages only; null for messages from others. */
  sendState: SendState | null
}

export interface ChatSummary {
  chatId: string
  kind: ChatKind
  name: string
  avatar: MediaRef | null
  lastMessage: MessagePreview | null
  unreadCount: number
  updatedAtMs: number
  memberCount: number
  state: ChatState
  /** The other user of a direct chat. */
  peer: UserProfile | null
  /** Unix ms; 0 when not muted. */
  mutedUntilMs: number
  pinned: boolean
  archived: boolean
  blocked: boolean
}

export interface MediaRef {
  chatId: string
  messageId: string
  mime: string
  size: number
  hasThumbnail: boolean
}

export type MessageContent
  = | { type: 'Text', body: string }
    | { type: 'Image', media: MediaRef, width: number, height: number, caption: string | null }
    | { type: 'File', media: MediaRef, fileName: string, caption: string | null }
    | { type: 'Deleted' }
    | { type: 'Unsupported' }

export interface ReplyPreview {
  messageId: string
  senderName: string
  text: string
}

export interface ReactionGroup {
  emoji: string
  count: number
  /** Whether the signed-in user reacted with this emoji. */
  own: boolean
}

export type SendFailure
  = 'UserSuspended' | 'UserNotAdmitted' | 'NotAdmittedByPeer' | 'Rejected' | 'Other'

export type SendState
  = | { type: 'Pending' }
    | { type: 'Sent' }
    | { type: 'Delivered' }
    | { type: 'Read' }
    | { type: 'Failed', reason: string, cause: SendFailure }

export interface MessageItem {
  messageId: string
  chatId: string
  sender: UserProfile
  isOwn: boolean
  sentAtMs: number
  content: MessageContent
  replyTo: ReplyPreview | null
  reactions: ReactionGroup[]
  edited: boolean
  /** Set only for own messages. */
  sendState: SendState | null
}

export type MembershipChangeKind = 'Added' | 'Removed' | 'Left'

export type TimelineItem
  = | { type: 'Message', item: MessageItem }
    | { type: 'DateSeparator', dayStartMs: number }
    | {
      type: 'MembershipChange'
      userName: string
      change: MembershipChangeKind
      atMs: number
      userId: string
      actorUserId: string | null
    }

/**
 * One list change, mirroring eyeball-im `VectorDiff`. Indices refer to the
 * list as it is after the previous diff of the batch; see `applyDiffs`.
 */
export type VectorDiff<T>
  = | { type: 'Append', values: T[] }
    | { type: 'Clear' }
    | { type: 'PushFront', value: T }
    | { type: 'PushBack', value: T }
    | { type: 'PopFront' }
    | { type: 'PopBack' }
    | { type: 'Insert', index: number, value: T }
    | { type: 'Set', index: number, value: T }
    | { type: 'Remove', index: number }
    | { type: 'Truncate', length: number }
    | { type: 'Reset', values: T[] }

export type ChatListDiff = VectorDiff<ChatSummary>
export type TimelineDiff = VectorDiff<TimelineItem>

export interface PushRegistration {
  provider: string
  token: string
  appId: string | null
  sandbox: boolean | null
  p256dh: string | null
  auth: string | null
}

export type NotificationKind = 'Message' | 'Reaction' | 'Invite' | 'Membership' | 'Generic'

export interface NotificationContent {
  chatId: string | null
  chatTitle: string | null
  senderUserId: string | null
  senderDisplayName: string | null
  body: string
  messageId: string | null
  collapseId: string | null
  kind: NotificationKind
  shouldDisplay: boolean
  timestamp: number
}

export interface StartupInfo {
  serverUrl: string | null
  clientReady: boolean
  /** An existing local database could not be opened and was discarded. */
  localStateReset: boolean
  session: Session | null
  error: GimError | null
}

export interface LinkStart {
  linkId: string
  qrString: string
}

export interface LinkApproval {
  approvalId: string
  /** Six-digit code, e.g. `"123 456"`. */
  sas: string
  deviceId: string
}

export interface PrivacySettings {
  readReceipts: boolean
  typingIndicators: boolean
  blockedUserIds: string[]
}

export type ReportReason = 'Spam' | 'Harassment' | 'Inappropriate' | 'Scam' | 'Other'
