# gim-win

Windows desktop client for gim: a Tauri 2 shell whose Rust side wraps
gim-client-sdk and exposes it to a React frontend through Tauri commands and
events. Benchmarked against Telegram Desktop; shares wording, settings layout
and languages with the other gim clients.

## Stack

- Tauri 2 (Rust bridge over `gim-ffi`, the facade of gim-client-sdk,
  currently a path dependency on `/srv/gimhq/gim-client-sdk`).
- React + Vite, TanStack Router (file-based routes) and TanStack Query,
  Zustand, shadcn/ui base-nova on `@base-ui/react`, Tailwind CSS v4.
- Bun for tooling, Vitest for tests, ESLint with `@antfu/eslint-config`.
- TypeScript is pinned to 6.x until typescript-eslint supports the TS 7 API.

## Layout

- `src/app/` - entry (`main.tsx`), providers, routes and the generated
  route tree.
- `src/components/ui/` - shadcn primitives (owned code, added via the CLI).
- `src/lib/` - shared helpers.
- `src/index.css` - Tailwind imports and the theme tokens.
- `src-tauri/` - the Rust crate, `tauri.conf.json`, capabilities and icons.
- `docker/` - the gate image.
- `scripts/` - `gate.sh`.
- `docs/` - plans and tasks.

## Checks

```bash
bash scripts/gate.sh
```

Builds `ai-agent/gim-win-gate` from `docker/gate.Dockerfile` when missing
(or with `GIM_WIN_GATE_REBUILD=1`) and runs, in one container:
`bun install --frozen-lockfile`, `bun run lint`, `bun run typecheck`,
`bun run test`, `bun run build`, then in `src-tauri`: `cargo fmt --check`,
`cargo clippy --all-targets -- -D warnings`, `cargo test`, `cargo build`.

- Caches: cargo home `GIM_CARGO_CACHE` (default `/srv/.tmp/cache/cargo`),
  Bun cache `GIM_BUN_CACHE` (default `/srv/.tmp/cache/bun`).
- `GIM_WIN_GATE_ONLY=frontend|rust` runs one half.
- `CARGO_TARGET_DIR`, when set, is mounted at the same path so parallel
  checkouts share one compiled target directory.

The first run builds the image and compiles the SDK (OpenSSL and SQLCipher
from source); expect 20-40 minutes.

## Development

```bash
bun install
bun run dev:web   # web view alone on http://localhost:1420
bun run dev       # Tauri dev; needs a Rust toolchain with the Tauri prerequisites
```

This station has no Rust toolchain; Rust checks run in the gate image.

## Bridge conventions

The Rust side (`src-tauri/src/bridge/`) holds one `gim_ffi::GimClient` per
process in Tauri managed state and exposes it as Tauri commands; the
frontend wraps them in `src/lib/api.ts`. The SDK contract is
`gim-client-sdk/docs/API.md`.

### Commands and arguments

- The command name (the string passed to `invoke`) is the snake_case
  `GimClient` method name from API.md (`create_identity`, `set_primary_hub`,
  ...); the TypeScript wrapper has the camelCase name.
- Arguments are a JSON object with camelCase keys (Tauri's default
  renaming): `restore_from_recovery({ userId, recoveryCode, revokeOthers })`.
- Every record is serialised with serde `rename_all = "camelCase"`
  (`src-tauri/src/bridge/types.rs` mirrors gim-ffi's records field by
  field). Optional fields are `null` when absent; timestamps are Unix
  milliseconds; counts are numbers; ids are strings.
- Unit enums (`ChatKind`, `ChatState`, `HubState`, `ConnectionState`,
  `SendFailure`, `MembershipChangeKind`, `NotificationKind`) are plain
  strings with the API.md variant name (`"Active"`, `"Verified"`, ...).
- Data-carrying enums are internally tagged with `type`:
  `TimelineItem` (`{type:"Message", item}`,
  `{type:"DateSeparator", dayStartMs}`, `{type:"MembershipChange", ...}`),
  `MessageContent` (`Text`, `Image`, `File`, `Deleted`, `Unsupported`),
  `SendState` (`{type:"Pending"}` ... `{type:"Failed", reason, cause}`),
  `ChatListDiff` and `TimelineDiff` (`Append`, `Clear`, `PushFront`,
  `PushBack`, `PopFront`, `PopBack`, `Insert`, `Set`, `Remove`, `Truncate`,
  `Reset`, with `values`, `value`, `index`, `length` as in gim-ffi).

Core commands (W1-2): `startup() -> StartupInfo`,
`set_server_url(url) -> StartupInfo`, `session() -> Session|null`,
`user_id() -> string|null`, `local_state_reset() -> boolean`,
`create_identity(displayName) -> string` (recovery code),
`restore_from_recovery(userId, recoveryCode, revokeOthers)`,
`rotate_recovery_code() -> RecoveryRotation`,
`start_link(hubs: string[]) -> {linkId, qrString}`,
`wait_link(linkId) -> string` (SAS), `confirm_link(accepted)`,
`approve_link(qrString) -> {approvalId, sas, deviceId}`,
`confirm_approval(approvalId, accepted)`, `devices() -> DeviceInfo[]`,
`user_devices(userId) -> DeviceInfo[]`, `revoke_device(deviceId)`,
`set_display_name(name)`, `claim_handle(handle)`, `release_handle()`,
`sign_out()`, `start_sync()`, `stop_sync()`,
`set_network_reachable(reachable)`, `set_local_time_zone(system)`,
`find_user(handle) -> UserProfile|null`, `hubs() -> HubInfo[]`,
`add_hub(url) -> HubInfo`, `remove_hub(hubId, confirmOwnedGroups)`,
`set_primary_hub(hubId)`, `register_push(registration: PushRegistration)`,
`unregister_push()`, `process_push(payload) -> NotificationContent`,
`core_version() -> string`, `ciphersuite_name() -> string`.

`StartupInfo` is `{serverUrl, clientReady, localStateReset, session, error}`:
`startup` waits for the startup task, so it never reports a half-initialised
state. Link handles (`LinkSession`, `PendingApproval`) stay in Rust under
bridge-issued ids; an unknown id is `InvalidInput`. `confirm_approval` uses
the approval up either way. `sign_out` and `confirm_link(false)` drop every
handle and create a fresh client afterwards (API.md: "Create a new client
afterwards").

Chat and timeline commands (W1-3): `create_direct_chat(userId) -> string`,
`create_group_chat(name, memberUserIds: string[]) -> string`,
`chat_members(chatId) -> UserProfile[]`, `add_members(chatId, userIds)`,
`remove_member(chatId, userId)`, `leave_chat(chatId)`,
`chat_state(chatId) -> ChatState`,
`set_group_info(chatId, name: string|null, avatarFilePath: string|null)`,
`send_text(chatId, body, replyTo: string|null) -> string`,
`send_media(chatId, filePath, mime, caption: string|null, replyTo: string|null) -> string`,
`edit_message(chatId, messageId, newBody)`, `delete_message(chatId, messageId)`,
`react(chatId, messageId, emoji)`, `unreact(chatId, messageId, emoji)`,
`retry_send(chatId, messageId)`, `cancel_send(chatId, messageId)`,
`mark_read(chatId, upToMessageId)`, `set_typing(chatId, active)`,
`stop_typing(chatId)`, `fetch_media(chatId, messageId, destPath) -> string`,
`fetch_thumbnail(chatId, messageId, destPath) -> string|null`,
`paginate_backwards(chatId, count) -> boolean`,
`timeline_chat_state(chatId) -> ChatState|null`. The last two operate on
the per-chat `gim_ffi::Timeline` the bridge creates on first use and keeps
in the bundle (dropped on sign-out and client recreation).

Subscription commands (W1-3): `subscribe_chat_list() -> string`,
`subscribe_timeline(chatId) -> string`, `subscribe_connection_state() -> string`,
`subscribe_typing(chatId) -> string`, `subscribe_hub_list() -> string` each
return a subscription id and keep the SDK's `TaskHandle` in the bundle;
`unsubscribe(subscriptionId)` cancels and drops it (an unknown id is not an
error). See "Events" below.

Settings commands (W1-3, API.md "Privacy and chat settings"):
`own_profile() -> UserProfile|null`, `set_avatar(filePath, mime)`,
`remove_avatar()`, `fetch_user_avatar(userId, destPath) -> string`,
`fetch_chat_avatar(chatId, destPath) -> string`,
`privacy() -> {readReceipts, typingIndicators, blockedUserIds}`,
`set_read_receipts(enabled)`, `set_typing_indicators(enabled)`,
`block_user(userId)`, `unblock_user(userId)`,
`report_user(userId, reason, note: string|null, messageIds: string[]) -> string`
(`reason` is `"Spam"`, `"Harassment"`, `"Inappropriate"`, `"Scam"` or
`"Other"`), `set_chat_muted(chatId, mutedUntilMs)`,
`set_chat_pinned(chatId, pinned)`, `set_chat_archived(chatId, archived)`,
`muted_forever() -> number`. `muted_forever()` is gim-ffi's constant,
`u64::MAX`, which exceeds JavaScript's `Number.MAX_SAFE_INTEGER`; the bridge
passes the u64 through unchanged (a `ChatSummary.mutedUntilMs` of a chat
muted for good carries the same value), so compare it on the TypeScript side
with that in mind.

### Errors

A failed command rejects with `{kind, message, ...fields}`: `kind` is the
`GimError` variant name (`Network`, `NotRegistered`, `InvalidInput`,
`NotFound`, `Crypto`, `Storage`, `Server`, `RetryLater`, `Cancelled`,
`NotImplemented`, `Internal`, `ChatNotActive`, `HubNotVerified`,
`HubOwnsGroups`, `LastHub`, `HomeHub`, `HubNotDrained`, `UserSuspended`,
`UserNotAdmitted`, `NotAdmittedByPeer`, `ContactNotAdmitted`), `message`
its Display text, and the variant's fields follow camelCased (`reason`,
`status`, `retryAfterSecs`, `chatId`, `state`, `hubId`, `groupCount`,
`userIds`). A bridge-level failure uses `Internal` (no client:
`client not created: <startup error>`) or `InvalidInput` (unknown handle id,
bad URL).

### Server URL

Precedence: env `GIM_WIN_SERVER_URL` > `serverUrl` in
`<appDataDir>/config.json` > unset. `appDataDir` is Tauri's app data
directory joined with `gim` (`%APPDATA%\im.g.gimwin\gim` on Windows,
`~/.local/share/im.g.gimwin/gim` on Linux); the SDK's `dataDir()` is
`<appDataDir>/data`. Both are created at startup; a failure is reported as
a `Storage` error in `StartupInfo.error`.

The optional gim app server URL (`ClientConfig.appServerUrl`: settings
backup and abuse reports) follows the same precedence: env
`GIM_WIN_APP_SERVER_URL` > `appServerUrl` in `config.json` > unset. It is
validated like the server URL when set (an invalid value fails the client
creation with `InvalidInput`) and is not exposed to the frontend.

At startup the bridge reads the configuration and, if a URL is configured,
creates the client, sets the OS time zone on it and records
`localStateReset()`. A failed creation is not fatal: the window opens and
`startup` reports the error. `set_server_url(url)` validates `http(s)://`
with a host, writes `config.json` and recreates the client; it is
`InvalidInput` while a session exists (sign out first). The environment
variable keeps winning over a URL written by `set_server_url`.

### Secure store

The SDK's secrets (database key, session, device key, push registration) go
through the `keyring` crate under the service name `im.g.gimwin`, one entry
per key:

- Windows: the Credential Manager, always.
- Linux: the freedesktop secret service (`sync-secret-service`, pure-Rust
  crypto). `GIM_WIN_SECURE_STORE=keyring` forces it, `=file` forces the
  file store; unset, the bridge probes the secret service once at startup
  and falls back to the file store when it is unavailable, logging the
  choice at info level.
- File store (Linux only): an SQLCipher database `<appDataDir>/secure-store.db`
  (table `secrets(key, value)`) keyed from `<appDataDir>/secure-store.key`
  (32 random bytes as hex, created with mode 0600). It protects the secrets
  at rest with a key kept next to them under owner-only permissions: the
  headless/dev fallback, not a credential manager.

Hooks (`PlatformHooks`, `LocalTimeZone`) run on gim-core's callback
thread: they copy data and return, never call the client and never wait on
the Tauri runtime. Reachability is an `AtomicBool` read by the hooks and
set by `set_network_reachable`, which also forwards it to the client.
`set_local_time_zone(true)` installs the OS zone (`chrono::Local`, the
offset in effect at each instant, DST included); `false` is UTC.

### Events

Subscription commands (W1-3) emit one Tauri event per listener callback,
batches in callback order: `chat-list-diff` `{subscriptionId, diffs}`,
`timeline-diff` `{subscriptionId, chatId, diffs}`, `connection-state`
`{subscriptionId, state}`, `typing` `{subscriptionId, chatId, userIds}`,
`hub-list` `{subscriptionId, hubs}`. The first event after subscribing
carries the current value (`Reset` for lists, the current state, typing
set or hub list). The names live in `src-tauri/src/bridge/events.rs`, next
to one emitter struct per gim-ffi listener trait: each holds the
`AppHandle`, its subscription id (and chat id) and, on gim-core's callback
thread, converts the batch to the serde mirrors, calls `app.emit` and
returns; it never calls the client or touches the bundle, and an emit
failure is logged at warn level. Subscriptions end with `unsubscribe`, and
all of them when the bundle is dropped (`sign_out`, `confirm_link(false)`,
`set_server_url`).

## Dev hub

(documented by a later task)
