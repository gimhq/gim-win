# gim-win

## Overview

Windows desktop client for gim: a Tauri 2 shell whose Rust side wraps
gim-client-sdk and exposes it to a React frontend through Tauri commands and
events. Benchmarked against Telegram Desktop; shares wording, settings layout
and languages with the other gim clients. The Rust bridge is the only place
that talks to the SDK; the frontend only ever calls the typed wrappers in
`src/lib/api/`.

## Stack

- Tauri 2 (Rust bridge over `gim-ffi`, the facade of gim-client-sdk,
  currently a path dependency on `/srv/gimhq/gim-client-sdk`).
- React + Vite, TanStack Router (file-based routes) and TanStack Query,
  Zustand, shadcn/ui base-nova on `@base-ui/react`, Tailwind CSS v4,
  i18next + react-i18next.
- Bun for tooling, Vitest (jsdom, Testing Library) for tests, ESLint with
  `@antfu/eslint-config`.
- TypeScript is pinned to 6.x until typescript-eslint supports the TS 7 API.

## Layout

```
src-tauri/
  src/bridge/mod.rs        managed state, startup, client (re)creation, generate_handler! list
  src/bridge/commands/     one Tauri command per GimClient method, grouped as in API.md
  src/bridge/types.rs      serde mirrors of gim-ffi's records and enums
  src/bridge/events.rs     event names and the listener-to-event emitters
  src/bridge/config.rs     GIM_WIN_SERVER_URL / GIM_WIN_KEEP_SERVER_URL / config.json
  src/bridge/hooks.rs      PlatformHooks, secure store selection, system time zone
  src/bridge/state.rs      BridgeState, ClientBundle (client, timelines, subscriptions, link handles)
  src/bridge/error.rs      BridgeError: GimError as {kind, message, ...fields}
  src/system/              settings.json, tray, close-to-tray, notifications, badge, autostart
  tauri.conf.json, capabilities/, icons/
src/app/                   main.tsx, providers, theme, routes/ (TanStack file routes) and routeTree.gen.ts
src/components/ui/         shadcn primitives (owned code, added via the CLI)
src/features/settings/     settings store, system command wrappers (system-api.ts), sections, flags.ts
src/features/system/       <SystemIntegration />: sync, unread badge, notifications, app shortcuts, tray labels
src/lib/api/               commands.ts, events.ts, errors.ts, types.ts; src/lib/api.ts re-exports index.ts
src/lib/shortcuts.ts       keyboard shortcut registry with stacked scopes
src/lib/format.ts          locale-aware date, time and size formatting
src/i18n/                  i18next instance, resources.ts, locales/<lang>/<namespace>.json, completeness test
src/index.css              Tailwind imports and the theme tokens
docker/gate.Dockerfile     the gate image (Rust stable, Tauri prerequisites, Node 22, Bun)
scripts/gate.sh            the full check inside the gate image
scripts/dev-hub.sh         disposable gim-hub for a dev session
scripts/licences.mjs       regenerates src/features/settings/about/licences.json
.github/workflows/ci.yml   the same checks on GitHub Actions (Linux) plus a Windows debug build
docs/                      plans and tasks
```

## Bridge conventions

The Rust side (`src-tauri/src/bridge/`) holds one `gim_ffi::GimClient` per
process in Tauri managed state and exposes it as Tauri commands; the
frontend wraps them in `src/lib/api/` (`commands.ts`, `events.ts`,
`errors.ts`, `types.ts`; `src/lib/api.ts` re-exports the index). The SDK
contract is `gim-client-sdk/docs/API.md`.

SDK commit mirrored: gim-client-sdk `2eb3316e88a63d89566fbceb208d96f848b974d3`
(the HEAD the bridge was last built and checked against; `gim-ffi` is a
path dependency, so the checkout at `/srv/gimhq/gim-client-sdk` is what
compiles).

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
`set_display_name(name)`, `sign_out()`, `delete_account() -> string[]`,
`start_sync()`, `stop_sync()`, `set_network_reachable(reachable)`,
`set_local_time_zone(system)`, `hubs() -> HubInfo[]`,
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
afterwards"). `delete_account` (API.md "Account deletion") deletes the
account on the keep server and every hub, leaves every chat and wipes this
device; it returns the hub ids it could not reach and the bridge then
creates a fresh client like `sign_out`. On a rejection nothing local was
deleted and the client stays usable, so it can be called again. It is
irreversible: the frontend must ask for an explicit confirmation.

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
muted for good carries the same value). JSON carries it as
`18446744073709551615`; `JSON.parse` rounds that to `18446744073709552000`,
and every value at or above `Number.MAX_SAFE_INTEGER` (2^53 - 1) has lost
precision and is no usable timestamp. `src/lib/api` therefore exports
`isMutedForever(mutedUntilMs)` (true at or above `MAX_SAFE_INTEGER`) and
`isMuted(mutedUntilMs, now = Date.now())` (0 is unmuted, forever counts,
otherwise the time must be ahead of `now`); use them instead of comparing
with `mutedForever()` for equality.

Recovery kit and desktop commands (W2-1, API.md "Recovery kit"), in
`src-tauri/src/recovery_kit.rs` and `src/lib/api/recovery-kit.ts`:
`format_recovery_kit(userId, recoveryCode, labels: {title, accountId, recoveryKey, note}) -> string`,
`parse_recovery_kit(text) -> {userId: string|null, recoveryCode: string|null}`,
`recovery_key_ending(recoveryCode) -> string`,
`matches_recovery_key_ending(recoveryCode, typed) -> boolean` delegate to
gim-ffi's synchronous helpers and never reject.
`save_text_file(defaultName, contents) -> string|null` opens the native
save dialog (`tauri-plugin-dialog`, permission `dialog:default`) and
writes `contents` to the chosen path, `null` when cancelled; a write
failure is `Storage`. `tauri-plugin-clipboard-manager` is registered with
`clipboard-manager:allow-write-text` so the frontend can copy the kit
through the plugin's `writeText`.

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

### Server URLs

The built-in defaults are defined once in `src-tauri/src/bridge/config.rs`:
`BUILT_IN_SERVER_URL = "https://hub.g.im"` and
`BUILT_IN_KEEP_SERVER_URL = "https://keep.g.im"`.

Hub precedence: env `GIM_WIN_SERVER_URL` > `serverUrl` in
`<appDataDir>/config.json` > built-in. `appDataDir` is Tauri's app data
directory joined with `gim` (`%APPDATA%\im.g.gimwin\gim` on Windows,
`~/.local/share/im.g.gimwin/gim` on Linux); the SDK's `dataDir()` is
`<appDataDir>/data`. Both are created at startup; a failure is reported as
a `Storage` error in `StartupInfo.error`.

The gim keep server (`ClientConfig.keepServerUrl`: settings backup and
abuse reports) has the precedence env `GIM_WIN_KEEP_SERVER_URL` >
`keepServerUrl` in `config.json` > built-in. `config.json` holds the user's
choice: the key absent = the built-in server, a string URL = a custom one,
JSON `null` or the string `"off"` = off (`keepServerUrl: None`; no settings
backup, `report_user` fails). The environment variable takes a URL and wins
over the stored choice, including off. Writes keep every other key of
`config.json`; an empty environment variable counts as unset.

One URL rule for both: `https://` with a host, or `http://` only to a local
host (`localhost`, a loopback, private or link-local IP: IPv4 10/8,
172.16/12, 192.168/16, 127/8, 169.254/16, IPv6 `::1`, fc00::/7, fe80::/10;
a name ending in `.local` or `.lan`; a single label without a dot, such as a
dev container name). `isAllowedServerUrl` in `src/lib/api/server-url.ts`
mirrors it. A URL breaking the rule fails the client creation with
`InvalidInput`.

At startup the bridge reads the configuration, creates the client (always:
the built-in hub applies when none is set), sets the OS time zone on it and
records `localStateReset()`. A failed creation is not fatal: the window opens
and `startup` reports the error. `StartupInfo.serverUrl` is the effective hub
URL, which pre-fills the onboarding server field ("Use another server").
`set_server_url(url)` validates the URL, writes `config.json` and recreates
the client; it is `InvalidInput` while a session exists (sign out first; the
hub of a signed-in account is not migrated). The environment variable keeps
winning over a URL written by `set_server_url`.

Keep server commands (Settings > Advanced):
`keep_server() -> KeepServerInfo`, `set_keep_server_url(url) -> KeepServerInfo`
(validates, stores the URL), `reset_keep_server() -> KeepServerInfo` (removes
the key), `disable_keep_server() -> KeepServerInfo` (stores `"off"`) and
`restart_app()` (restarts the process). `KeepServerInfo` is
`{url: string|null, source: "env"|"config"|"builtIn"|"off", defaultUrl,
restartRequired}`; `restartRequired` is true when the effective URL differs
from the one the running client was created with. A change applies on the
next client creation, so the UI offers "Restart now". With the environment
variable set the commands still write `config.json`, and `source` stays
`"env"`.

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

## Checks

```bash
export CARGO_TARGET_DIR=/srv/.tmp/cache/gim-win-target   # optional, shared target dir
bash scripts/gate.sh
```

`scripts/gate.sh` builds `ai-agent/gim-win-gate` from `docker/gate.Dockerfile`
when the image is missing (or with `GIM_WIN_GATE_REBUILD=1`) and runs, in one
container with the checkout mounted at its own path and
`/srv/gimhq/gim-client-sdk` mounted read-only: `bun install
--frozen-lockfile`, `bun run lint`, `bun run typecheck`, `bun run test`,
`bun run build`, then in `src-tauri`: `cargo fmt --check`,
`cargo clippy --all-targets -- -D warnings`, `cargo test`, `cargo build`.

- Caches: cargo home `GIM_CARGO_CACHE` (default `/srv/.tmp/cache/cargo`),
  Bun cache `GIM_BUN_CACHE` (default `/srv/.tmp/cache/bun`).
- `GIM_WIN_GATE_ONLY=frontend|rust` runs one half.
- `CARGO_TARGET_DIR`, when set, is mounted at the same path so parallel
  checkouts share one compiled target directory.
- The checkout must live under `/srv` (the host daemon mounts it).

The first run builds the image and compiles the SDK (OpenSSL and SQLCipher
from source); expect 20-40 minutes. Later runs take a few minutes.

### CI

`.github/workflows/ci.yml` runs the same frontend and Rust steps on
`ubuntu-latest` and a `bun tauri build --debug` on `windows-latest`. Both
jobs check out `gimhq/gim-client-sdk` next to the repository and link it to
`/srv/gimhq/gim-client-sdk` (a junction under `C:\srv` on Windows), the path
`src-tauri/Cargo.toml` expects; this is temporary until the SDK becomes a
git dependency. The repository has no remote yet, so the workflow has not
run; the gate is the check that counts.

## Dev hub

```bash
export GIM_WIN_SERVER_URL=$(scripts/dev-hub.sh start)   # first run builds the hub image: minutes
scripts/dev-hub.sh status | url | logs | ip | commit
scripts/dev-hub.sh stop
```

`scripts/dev-hub.sh` delegates to `$GIM_SDK_SRC/scripts/gim-hub-dev.sh`
(default `/srv/gimhq/gim-client-sdk`) with gim-win's defaults, each
overridable from the environment: `GIM_HUB_SRC=/srv/gimhq/gim-hub`,
`GIM_HUB_IMAGE=ai-agent/gim-hub`, `GIM_HUB_NETWORK=traefik`,
`GIM_HUB_NAME=ai-agent-gim-hub-win`. The hub runs with `--rm`, labelled
`ai-agent=true`, with in-memory data, at the gim-hub commit the SDK pins
(`GIM_HUB_REV`). `start` waits for `/healthz`, prints the URL as its last
stdout line (`http://ai-agent-gim-hub-win:8080`) and the matching
`GIM_WIN_SERVER_URL=<url>` hint on stderr; a running hub is reused.

The URL resolves by container name from containers on the `traefik`
network, this station included. A Tauri window running elsewhere needs
`GIM_HUB_PUBLIC_URL` set to an address it can reach (a published port, for
example): the wrapper passes it through unchanged, and the hub signs
clients in at that URL only.

## Development

```bash
bun install
bun run dev:web   # web view alone on http://localhost:1420
bun run dev       # Tauri dev (bun tauri dev)
```

`bun run dev:web` serves the React app in a browser. Every bridge call
fails visibly there: `invoke` is not available outside Tauri, so the
wrappers reject with an `Internal` error, starting with the `startup` call
of the `/` route, which the router surfaces as a route error. Use it for
layout, i18n and anything that does not need the SDK.

`bun run dev` needs a local Rust toolchain with the Tauri prerequisites
(the Linux packages listed in `docker/gate.Dockerfile`, or Windows with the
WebView2 runtime and the MSVC build tools). This station has no Rust
toolchain; Rust checks run in the gate image. Running `bun tauri dev` inside
the gate image is untested: the image has the toolchain and WebKitGTK but
no display, so it would need an X server mounted (`-v /tmp/.X11-unix` and
`-e DISPLAY`, or a nested Xvfb/VNC) in addition to the mounts
`scripts/gate.sh` uses; try it from a copy of that script if a Linux window
is wanted.

Point the client at a hub with `GIM_WIN_SERVER_URL` (see "Dev hub");
without it the client uses `config.json` or the built-in hub.

## i18n

`src/i18n/` holds an i18next instance with static resources: four languages
(`en`, `zh-CN`, `zh-TW`, `es`) and five namespaces (`common`, `onboarding`,
`account`, `chat`, `settings`), one JSON file each under
`locales/<language>/<namespace>.json`, wired in `resources.ts`. The language
is the persisted choice (`localStorage` key `gim.language`) or the system
language mapped to a supported one (`mapLanguageTag`: `zh-TW`, `zh-HK`,
`zh-MO` and `Hant` to `zh-TW`, other `zh` to `zh-CN`, `es` to `es`, anything
else to `en`); `setLanguage` changes and persists it. `<html lang>` is set
at init and on every `setLanguage`; `LANGUAGE_NAMES` holds each language
in its own words for the language picker.

`completeness.test.ts` fails when a language lacks a namespace file, when a
file exists outside the declared languages and namespaces, when a language
has keys missing from or absent in `en`, or when a value is empty or not a
string. To add a key: add it to `locales/en/<namespace>.json`, then to the
same namespace of the other three languages, then use it with
`useTranslation('<namespace>')`. A new namespace also goes into
`NAMESPACES` and `resources` in `resources.ts`.

## Shortcuts and formatting

`src/lib/shortcuts.ts` is a keyboard shortcut registry with stacked scopes:
`register(scope, combo, handler)` binds a combo written as modifiers joined
with `+` and a `KeyboardEvent.key` name (`Mod+K`, `Ctrl+Shift+Enter`,
`Escape`), where `Mod` is Ctrl on Windows and Linux and Meta on macOS;
`pushScope` / `popScope` make a dialog's bindings shadow the global ones,
`installShortcuts(window)` dispatches `keydown` to the innermost scope
that handles the combo, and `resetShortcuts` clears everything for tests.

`src/lib/format.ts` holds pure, locale-aware helpers that default to the
active i18n language: `formatBytes` (`512 B`, `1.5 MB`), `formatTime`,
`formatDate`, `formatDateTime`, `formatRelativeTime` (`Intl.RelativeTimeFormat`,
"now" under a minute), `formatChatListTime` (time today, short weekday within
six days, else the date) and `formatDayLabel` (`today` / `yesterday` / a
date, for the caller to translate).

## Settings and system integration

The desktop integration is native Tauri code in `src-tauri/src/system/`; it
never touches gim-core or the bridge state. Its commands reject with
`{kind, message}` (`Internal`, `Storage`, `InvalidInput`), the bridge's error
shape, so `isGimError` applies. The frontend calls them only through
`src/features/settings/system-api.ts`.

- Settings: `<appDataDir>/gim/settings.json`, loaded once at setup and
  written atomically (`settings.json.tmp`, then rename). The shape is
  `{notifications: {enabled, sound, showText}, fontSize, trayEnabled}`
  (`fontSize`: `small`, `normal`, `large`, `extraLarge`); a missing or
  unparsable file yields the defaults (everything on, `normal`), and missing
  fields take their default. `useSettingsStore`
  (`src/features/settings/store.ts`) loads it once, applies a patch at once
  and saves the whole object; the font size is set as `--app-font-size`
  (14/16/18/20px) on the root element.
- Commands: `settings_load() -> AppSettings`, `settings_save(settings)`,
  `set_badge_count(count)`, `notify(title, body, chatId)`,
  `show_main_window()`, `hide_to_tray()`, `quit_app()`,
  `set_tray_labels(show, hide, quit)`.
- Tray: built in code when `trayEnabled` is set and rebuilt or removed when
  `settings_save` flips it. Left click and "Show" bring the window back,
  "Hide" hides it, "Quit" exits. The menu labels follow the UI language
  (`set_tray_labels` after i18n init and on every language change).
- Close-to-tray: with the tray enabled, closing the window hides it and
  `hide_to_tray` hides; with the tray off both exit the app. `quit_app`
  always exits.
- Badge: the unread total of the chats that are neither archived nor left,
  drawn as a 16x16 overlay (red disc, `1`-`9`, `9+`) on the Windows taskbar
  icon; `0` clears it, and elsewhere `set_badge_count` is a no-op.
- Notifications: while the window is hidden or unfocused, a new incoming
  message of an unmuted chat shows a toast through
  tauri-plugin-notification, per the Notifications settings (`enabled`;
  `showText` off sends a generic body; `sound` requests the default toast
  sound on Windows, other desktops follow the OS). Clicks are delivered
  through the plugin's desktop action callback (the `tap` action carrying
  the `chatId` extra): the window is shown and focused, the
  `notification-clicked` event `{chatId}` is emitted and the frontend opens
  `/chats/$chatId`. On Windows this works only while the toast is on
  screen, not from the Action Center.
- The Windows-only paths (the overlay badge, the toast sound) are not
  compiled by the Linux gate.
- Autostart: tauri-plugin-autostart, toggled from Appearance through
  `@tauri-apps/plugin-autostart`.
- Window state: tauri-plugin-window-state restores size and position.
- Single instance: tauri-plugin-single-instance; a second launch shows and
  focuses the running window.
- Shortcuts: `Mod+,` opens settings, `Mod+Q` quits, `Mod+W` runs
  `hide_to_tray`. `<SystemIntegration />`
  (`src/features/system/system-integration.tsx`, mounted by the `_shell`
  route) installs them together with the shortcut dispatcher, exactly once.
- Sync: `<SystemIntegration />` starts it once when the shell mounts with a
  session (`src/features/system/sync.ts`); the bridge stops it on sign out
  and the next sign-in starts it again.
- Unread total: the badge and the message notifications read the chat list
  store (`selectTotalUnread`, see "Chats and search"); only the `_shell`
  route starts its subscription.
- Licences: `src/features/settings/about/licences.json` lists the npm
  `dependencies` and the `src-tauri/Cargo.toml` dependencies. Regenerate it
  with `bun install` then `bun run licences`, inside the gate image so cargo
  is there for the cargo licences (without cargo the previous values are
  kept); `licences.test.ts` fails when a dependency is missing from it.
- Flags: `FLAGS.accountSafetyEntries` (C7) in
  `src/features/settings/flags.ts` hides the entries whose SDK support is
  not surfaced yet (profile photo, chat controls, read receipts, typing
  indicators, blocked users, delete account); it gates nothing else.

## Status

W1 baseline: scaffold, gate and CI, the complete bridge (every `GimClient`
method of the mirrored SDK commit as a command, the five event streams), the
typed frontend wrappers, the shell layout, i18n, shortcuts and formatting
helpers, and the dev hub script. The feature workstreams W2-W4 (onboarding
and account, chats and timeline, settings) build on it. W4 done: settings
persistence and sections, the system module (tray, close-to-tray, badge,
notifications, autostart, window state, single instance, shortcuts) and the
licences list; the recovery kit
helpers of the SDK are not bridged yet and belong to the onboarding
workstream. The `zh-CN`, `zh-TW` and `es` translations are drafts.

## Chats and search

- The chat list lives in a Zustand store (`src/features/chats/store.ts`) fed
  by the SDK's chat list diffs; `selectTotalUnread` sums the unread counts of
  chats that are neither archived nor left and drives the app badge.
- Shortcuts in the chat view: Ctrl+K search, Ctrl+N new chat, Ctrl+Up /
  Ctrl+Down previous / next chat, Esc back or close, Ctrl+F find in the open
  chat.
- Search is local only: an FTS5 index in `<appDataDir>/search.db` fed by the
  frontend (`src/features/chats/search/use-index-feed.ts`). It covers only
  the chats this device knows and the messages it has received and
  decrypted; the server has no search. Sign out calls `searchReset()` to
  delete the index; a failure there is logged and does not block sign out.
- Link previews are fetched by the app itself (at most 1 MiB, 5 s timeout,
  no private or local addresses), never through the server.
