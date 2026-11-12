/**
 * Typed wrappers over the Tauri bridge commands. Each wrapper invokes the
 * snake_case GimClient method of `docs/API.md` with the contract's argument
 * names and returns its serialised result. A rejection is a `GimError`
 * (see `./errors`); anything else is wrapped as `Internal`.
 */

import type { GimError } from './errors'
import type {
  ChatState,
  DeviceInfo,
  HubInfo,
  KeepServerInfo,
  LinkApproval,
  LinkStart,
  NotificationContent,
  PrivacySettings,
  PushRegistration,
  RecoveryRotation,
  ReportReason,
  Session,
  StartupInfo,
  UserProfile,
} from './types'
import { invoke } from '@tauri-apps/api/core'
import { isGimError } from './errors'

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args)
  }
  catch (error) {
    if (isGimError(error))
      throw error
    const internal: GimError = {
      kind: 'Internal',
      message: String(error),
      reason: String(error),
    }
    throw internal
  }
}

// --- Lifecycle and identity (W1-2) ---

/** Creates the client from the persisted server URL; `error` is set if that failed. */
export function startup(): Promise<StartupInfo> {
  return call('startup')
}

/** Persists the URL and recreates the client; `InvalidInput` if a session exists. */
export function setServerUrl(url: string): Promise<StartupInfo> {
  return call('set_server_url', { url })
}

/** The effective keep server and whether a restart is needed to use it. */
export function keepServer(): Promise<KeepServerInfo> {
  return call('keep_server')
}

/** Validates and stores a custom keep server; `InvalidInput` for a URL the bridge rejects. */
export function setKeepServerUrl(url: string): Promise<KeepServerInfo> {
  return call('set_keep_server_url', { url })
}

/** Removes the stored keep server: the built-in one applies after a restart. */
export function resetKeepServer(): Promise<KeepServerInfo> {
  return call('reset_keep_server')
}

/** Stores "off": no keep server after a restart. */
export function disableKeepServer(): Promise<KeepServerInfo> {
  return call('disable_keep_server')
}

/** Restarts gim, so the client is created with the stored settings. */
export function restartApp(): Promise<void> {
  return call('restart_app')
}

/** The persisted session, or `null` on first launch. */
export function session(): Promise<Session | null> {
  return call('session')
}

/** `null` without a session. */
export function userId(): Promise<string | null> {
  return call('user_id')
}

/** Whether opening this client discarded an existing local database. */
export function localStateReset(): Promise<boolean> {
  return call('local_state_reset')
}

/** Creates the user with this device as its first one; returns the recovery code, shown once. */
export function createIdentity(displayName: string): Promise<string> {
  return call('create_identity', { displayName })
}

/** Restores the identity on a fresh client; `revokeOthers` revokes every previously listed device. */
export function restoreFromRecovery(userId: string, recoveryCode: string, revokeOthers: boolean): Promise<void> {
  return call('restore_from_recovery', { userId, recoveryCode, revokeOthers })
}

/** Seals the root key with a new code; the old one keeps working on `unsyncedHubIds`. */
export function rotateRecoveryCode(): Promise<RecoveryRotation> {
  return call('rotate_recovery_code')
}

/** New device: starts a link session; show `qrString` as a QR code. */
export function startLink(hubs: string[]): Promise<LinkStart> {
  return call('start_link', { hubs })
}

/** New device: waits up to 10 minutes for the bundle and returns the SAS. */
export function waitLink(linkId: string): Promise<string> {
  return call('wait_link', { linkId })
}

/** New device: `false` wipes it like `signOut`; the bridge recreates the client. */
export function confirmLink(accepted: boolean): Promise<void> {
  return call('confirm_link', { accepted })
}

/** Old device: approves a scanned QR code; compare `sas` with the new device. */
export function approveLink(qrString: string): Promise<LinkApproval> {
  return call('approve_link', { qrString })
}

/** Old device: `true` adds the new device to all chats, `false` revokes it. */
export function confirmApproval(approvalId: string, accepted: boolean): Promise<void> {
  return call('confirm_approval', { approvalId, accepted })
}

/** Own devices, including revoked ones. */
export function devices(): Promise<DeviceInfo[]> {
  return call('devices')
}

/** Another user's devices; empty for an unknown user. */
export function userDevices(userId: string): Promise<DeviceInfo[]> {
  return call('user_devices', { userId })
}

/** Revokes another own device; `InvalidInput` for the current one. */
export function revokeDevice(deviceId: string): Promise<void> {
  return call('revoke_device', { deviceId })
}

/** Synced to the other own devices and announced to every chat; `InvalidInput` if empty. */
export function setDisplayName(name: string): Promise<void> {
  return call('set_display_name', { name })
}

/** Stops sync, deletes session and local data; the bridge then creates a fresh client. */
export function signOut(): Promise<void> {
  return call('sign_out')
}

/**
 * Irreversible: deletes the account on the keep server and every hub, leaves
 * every chat and wipes this device like `signOut`; ask for an explicit
 * confirmation first. Returns the hub ids that could not be reached. On a
 * rejection nothing local was deleted and it can be called again.
 */
export function deleteAccount(): Promise<string[]> {
  return call('delete_account')
}

/** Call when the app comes to the foreground. */
export function startSync(): Promise<void> {
  return call('start_sync')
}

/** Call when the app goes to the background. */
export function stopSync(): Promise<void> {
  return call('stop_sync')
}

/** Becoming reachable reconnects and retries the outbox at once; never throws. */
export function setNetworkReachable(reachable: boolean): Promise<void> {
  return call('set_network_reachable', { reachable })
}

/** `true` buckets date separators in the OS time zone, `false` in UTC. */
export function setLocalTimeZone(system: boolean): Promise<void> {
  return call('set_local_time_zone', { system })
}

/** Listed hubs, primary first, including removed ones. */
export function hubs(): Promise<HubInfo[]> {
  return call('hubs')
}

/** Verifies the URL, signs in and lists the hub last; `Network` if unreachable. */
export function addHub(url: string): Promise<HubInfo> {
  return call('add_hub', { url })
}

/** `HomeHub`, `LastHub`, `HubNotDrained`; `HubOwnsGroups` unless `confirmOwnedGroups`. */
export function removeHub(hubId: string, confirmOwnedGroups: boolean): Promise<void> {
  return call('remove_hub', { hubId, confirmOwnedGroups })
}

/** Gives the hub priority 0; `InvalidInput` for an unlisted or unreachable hub. */
export function setPrimaryHub(hubId: string): Promise<void> {
  return call('set_primary_hub', { hubId })
}

/** Stores the registration and sends it to every verified hub. */
export function registerPush(registration: PushRegistration): Promise<void> {
  return call('register_push', { registration })
}

/** Removes the registration from every hub, then locally. */
export function unregisterPush(): Promise<void> {
  return call('unregister_push')
}

/** Describes a push payload; `InvalidInput` only if it is not a JSON object. */
export function processPush(payload: string): Promise<NotificationContent> {
  return call('process_push', { payload })
}

/** Version of the gim-core library. */
export function coreVersion(): Promise<string> {
  return call('core_version')
}

/** The MLS ciphersuite used by every chat. */
export function ciphersuiteName(): Promise<string> {
  return call('ciphersuite_name')
}

// --- Chats and timeline (W1-3) ---

/** Returns the existing direct chat if there is one; `NotFound` or `ContactNotAdmitted` otherwise. */
export function createDirectChat(userId: string): Promise<string> {
  return call('create_direct_chat', { userId })
}

/** Unknown or not admitted invitees are skipped; fails if that is every invitee. */
export function createGroupChat(name: string, memberUserIds: string[]): Promise<string> {
  return call('create_group_chat', { name, memberUserIds })
}

/** Current members, one per user, the signed-in user included; re-query on chat list changes. */
export function chatMembers(chatId: string): Promise<UserProfile[]> {
  return call('chat_members', { chatId })
}

/** Skips users like `createGroupChat`; fails with nothing committed if that is every user. */
export function addMembers(chatId: string, userIds: string[]): Promise<void> {
  return call('add_members', { chatId, userIds })
}

export function removeMember(chatId: string, userId: string): Promise<void> {
  return call('remove_member', { chatId, userId })
}

/** Returns once the hub accepted the leave (`Leaving`); `ChatNotActive(Left)` once left. */
export function leaveChat(chatId: string): Promise<void> {
  return call('leave_chat', { chatId })
}

/** From local state, no network call; `NotFound` for an unknown chat. */
export function chatState(chatId: string): Promise<ChatState> {
  return call('chat_state', { chatId })
}

/** `null` leaves a field unchanged, at least one must be set; `InvalidInput` for direct chats. */
export function setGroupInfo(chatId: string, name: string | null, avatarFilePath: string | null): Promise<void> {
  return call('set_group_info', { chatId, name, avatarFilePath })
}

/** The message appears in the timeline immediately with `SendState.Pending`. */
export function sendText(chatId: string, body: string, replyTo: string | null): Promise<string> {
  return call('send_text', { chatId, body, replyTo })
}

/** The file is copied before the call returns. */
export function sendMedia(
  chatId: string,
  filePath: string,
  mime: string,
  caption: string | null,
  replyTo: string | null,
): Promise<string> {
  return call('send_media', {
    chatId,
    filePath,
    mime,
    caption,
    replyTo,
  })
}

export function editMessage(chatId: string, messageId: string, newBody: string): Promise<void> {
  return call('edit_message', { chatId, messageId, newBody })
}

export function deleteMessage(chatId: string, messageId: string): Promise<void> {
  return call('delete_message', { chatId, messageId })
}

export function react(chatId: string, messageId: string, emoji: string): Promise<void> {
  return call('react', { chatId, messageId, emoji })
}

export function unreact(chatId: string, messageId: string, emoji: string): Promise<void> {
  return call('unreact', { chatId, messageId, emoji })
}

/** For messages in `SendState.Failed`. */
export function retrySend(chatId: string, messageId: string): Promise<void> {
  return call('retry_send', { chatId, messageId })
}

/** For messages in `SendState.Failed`. */
export function cancelSend(chatId: string, messageId: string): Promise<void> {
  return call('cancel_send', { chatId, messageId })
}

/** M1 marks the whole chat read; `upToMessageId` is validated only. Sends a read receipt. */
export function markRead(chatId: string, upToMessageId: string): Promise<void> {
  return call('mark_read', { chatId, upToMessageId })
}

/** `true` on each keystroke (sent at most every 3 s), `false` when typing stops. */
export function setTyping(chatId: string, active: boolean): Promise<void> {
  return call('set_typing', { chatId, active })
}

/** Same as `setTyping(chatId, false)`; does nothing unless typing was reported. */
export function stopTyping(chatId: string): Promise<void> {
  return call('stop_typing', { chatId })
}

/** Downloads and decrypts the attachment to `destPath`; returns the file path. */
export function fetchMedia(chatId: string, messageId: string, destPath: string): Promise<string> {
  return call('fetch_media', { chatId, messageId, destPath })
}

/** `null` if the media has no thumbnail. */
export function fetchThumbnail(chatId: string, messageId: string, destPath: string): Promise<string | null> {
  return call('fetch_thumbnail', { chatId, messageId, destPath })
}

/** Loads up to `count` older items (delivered as timeline diffs); returns whether more history exists. */
export function paginateBackwards(chatId: string, count: number): Promise<boolean> {
  return call('paginate_backwards', { chatId, count })
}

/** The timeline's chat state; `null` while the chat is not known locally. */
export function timelineChatState(chatId: string): Promise<ChatState | null> {
  return call('timeline_chat_state', { chatId })
}

// --- Subscriptions (W1-3); prefer the helpers in `./events` ---

/** Starts a chat list stream; returns the subscription id. The first event is a `Reset`. */
export function subscribeChatList(): Promise<string> {
  return call('subscribe_chat_list')
}

/** Starts a timeline stream for the chat; the first event is a `Reset`, oldest first. */
export function subscribeTimeline(chatId: string): Promise<string> {
  return call('subscribe_timeline', { chatId })
}

/** Starts a connection state stream; the first event carries the current state. */
export function subscribeConnectionState(): Promise<string> {
  return call('subscribe_connection_state')
}

/** Starts a typing stream for the chat; reports user ids other than the signed-in user. */
export function subscribeTyping(chatId: string): Promise<string> {
  return call('subscribe_typing', { chatId })
}

/** Starts a hub list stream; the first event carries the current `hubs()`. */
export function subscribeHubList(): Promise<string> {
  return call('subscribe_hub_list')
}

/** Ends a stream; an unknown id is not an error. */
export function unsubscribe(subscriptionId: string): Promise<void> {
  return call('unsubscribe', { subscriptionId })
}

// --- Profile photo, privacy and chat settings (W1-3) ---

/** The signed-in user's profile; `null` without a session. */
export function ownProfile(): Promise<UserProfile | null> {
  return call('own_profile')
}

/** Uploads the image as the profile photo; synced to the own devices and announced to every chat. */
export function setAvatar(filePath: string, mime: string): Promise<void> {
  return call('set_avatar', { filePath, mime })
}

export function removeAvatar(): Promise<void> {
  return call('remove_avatar')
}

/** Downloads a user's profile photo to `destPath`; returns the file path. */
export function fetchUserAvatar(userId: string, destPath: string): Promise<string> {
  return call('fetch_user_avatar', { userId, destPath })
}

/** Downloads a group's photo to `destPath`; returns the file path. */
export function fetchChatAvatar(chatId: string, destPath: string): Promise<string> {
  return call('fetch_chat_avatar', { chatId, destPath })
}

/** Stored on the own devices only; all on and empty by default. */
export function privacy(): Promise<PrivacySettings> {
  return call('privacy')
}

/** Off: `markRead` sends no receipts and the others' are not shown. */
export function setReadReceipts(enabled: boolean): Promise<void> {
  return call('set_read_receipts', { enabled })
}

/** Off: no typing is sent and the others' is not shown. */
export function setTypingIndicators(enabled: boolean): Promise<void> {
  return call('set_typing_indicators', { enabled })
}

/** Drops the user's messages, reactions, receipts, typing and invites; existing chats stay. */
export function blockUser(userId: string): Promise<void> {
  return call('block_user', { userId })
}

/** Lets new messages through; the dropped ones do not come back. */
export function unblockUser(userId: string): Promise<void> {
  return call('unblock_user', { userId })
}

/** Sends the picked messages in plaintext to the keep server's moderators; returns the report id. Does not block. */
export function reportUser(userId: string, reason: ReportReason, note: string | null, messageIds: string[]): Promise<string> {
  return call('report_user', { userId, reason, note, messageIds })
}

/** `mutedUntilMs` in Unix milliseconds; `await mutedForever()` for good, 0 to unmute. */
export function setChatMuted(chatId: string, mutedUntilMs: number): Promise<void> {
  return call('set_chat_muted', { chatId, mutedUntilMs })
}

/** Pinned chats sort to the top of the chat list. */
export function setChatPinned(chatId: string, pinned: boolean): Promise<void> {
  return call('set_chat_pinned', { chatId, pinned })
}

/** Only sets `ChatSummary.archived`; a new message does not unarchive. */
export function setChatArchived(chatId: string, archived: boolean): Promise<void> {
  return call('set_chat_archived', { chatId, archived })
}

/** The `mutedUntilMs` of a chat muted for good (`u64::MAX`, see `isMutedForever`). */
export function mutedForever(): Promise<number> {
  return call('muted_forever')
}

// The SDK's MUTED_FOREVER is u64::MAX. JSON carries it as the integer
// 18446744073709551615, which JavaScript parses to 18446744073709552000:
// every value at or above Number.MAX_SAFE_INTEGER has lost precision, and
// none of them is a usable timestamp, so that is the threshold.

/** Whether `mutedUntilMs` (from `ChatSummary` or `mutedForever`) means muted until unmuted. */
export function isMutedForever(mutedUntilMs: number): boolean {
  return mutedUntilMs >= Number.MAX_SAFE_INTEGER
}

/** Whether the chat is muted at `now`: 0 is unmuted, forever counts, otherwise the time must be ahead. */
export function isMuted(mutedUntilMs: number, now: number = Date.now()): boolean {
  if (mutedUntilMs === 0)
    return false
  return isMutedForever(mutedUntilMs) || mutedUntilMs > now
}
