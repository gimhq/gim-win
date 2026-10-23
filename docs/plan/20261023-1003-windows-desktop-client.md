# 20261023-1003-windows-desktop-client Windows desktop client baseline (Tauri 2)

- **status**: implementing
- **createdAt**: 2026-10-23 10:03
- **approvedAt**: 2026-10-23 (user, via the workspace coordinator: auto mode activated on campaign `l1-0xhhlawj-20261023095300`, taking the coordinator's stack recommendation)
- **relatedTask**: 20261023-1003-windows-desktop-client

## Context

gim-win is a fresh repository (README only) that must become the Windows
desktop client of gim, benchmarked against Telegram Desktop. The workspace
ledger `/srv/gimhq/docs/plan/20261023-0953-clients-product-alignment.md`
(read-only) assigns this repo lane 3 of the client alignment campaign and
fixes the stack and the shared product contracts.

Stack (decided under auto mode; a different stack is a hard stop):

- **Tauri 2.** The Rust side depends on `gim-sdk` and `gim-store-sqlite`
  (and `gim-ui` for the chat list and timeline `VectorDiff` streams) from
  `/srv/gimhq/gim-client-sdk` by path, later by git dependency. BKD worktrees
  live under `/srv/bkd/worktrees/8l5uahun/<issue>`, so the path dependency
  must be the absolute path `/srv/gimhq/gim-client-sdk/crates/...` (a
  relative `../gim-client-sdk` resolves only from `/srv/gimhq/gim-win`).
  The client is exposed to the frontend through Tauri commands that mirror
  the FFI contract in `/srv/gimhq/gim-client-sdk/docs/API.md` (method names,
  arguments, error variants) and Tauri events that carry the `ChatListDiff`
  and `TimelineDiff` batches, connection state, typing and hub list updates.
- **Frontend:** React + Vite on the pma-web baseline: TanStack Router
  (file-based routes under `src/app/routes/`), TanStack Query, Zustand for
  UI state, shadcn/ui base-nova on `@base-ui/react` (no Radix), Tailwind,
  Vitest, ESLint with `@antfu/eslint-config`, Bun for tooling.
- **Platform hooks:** secrets through the OS credential store (Windows
  Credential Manager; Linux secret service or an encrypted file fallback for
  the gate), `dataDir` under the Tauri app data directory, reachability from
  the OS network status.

SDK surface the client consumes (`docs/API.md` sections *Lifecycle*,
*Identity and devices*, *GimClient*, *Timeline*, *Listeners and threading*,
*Diff semantics*; Rust sources `crates/gim-sdk/src/{client,identity,link,
send,media,hubs,secrets}.rs`, `crates/gim-ui/src/{chat_list,timeline,
listener,typing}.rs`, reference wrapper `bindings/gim-ffi/src/*.rs`):
`createIdentity`, `startLink`/`waitLink`/`confirmLink`,
`approveLink`/`confirmApproval`, `restoreFromRecovery`, `rotateRecoveryCode`,
devices, display name and handle, `createDirectChat`/`createGroupChat`,
members, `sendText`/`sendMedia`/`editMessage`/`deleteMessage`/`react`/
`retrySend`/`cancelSend`, `markRead`, typing, `fetchMedia`/`fetchThumbnail`,
`chatList`, `timeline(chatId).paginateBackwards`, `connectionState`, hubs.
Gaps that bound this plan: no search API (search is client-side over local
state), no link preview API (previews are fetched client-side, never through
the hub), no mute/pin/archive, block, report, avatar or account deletion yet
(contract C7: entries exist in the settings layout but stay hidden).

Shared product contracts (do not copy, reference):

- C1 glossary and writing rules:
  `git -C /srv/gimhq/gim-android show bkd/uxo2xvuo:docs/glossary.md`.
  Server, username, account ID, recovery key, remove device, connected / not
  checked, main server; sentence case; short verbs; errors say what happened
  and what to try. Code keeps the SDK terms.
- C2 recovery kit text and label-independent parser:
  `git -C /srv/gimhq/gim-android show bkd/liid6n5a:feature/onboarding/src/main/kotlin/im/g/apps/feature/onboarding/RecoveryKit.kt`.
  Title line, `Account ID: <user id>`, `Recovery key: <grouped code>`, blank
  line, note. Parsing finds the user ID token and a code of the right length
  regardless of language. Delivered in the SDK on 2026-10-23
  (gim-client-sdk 04a02b5: `format_recovery_kit`, `parse_recovery_kit`,
  `recovery_key_ending`, `matches_recovery_key_ending` in gim-sdk and
  gim-ffi); this repo links that tree by path, so W2 wraps the SDK functions
  in thin commands and ports nothing.
- C3 languages: en, zh-CN, zh-TW, es.
- C4 settings information architecture: avatar entry; sections Profile,
  Account and devices, Notifications, Appearance, Language, Advanced
  (servers), Help and about, Sign out; "How gim works" explainer text from
  `git -C /srv/gimhq/gim-android show bkd/liid6n5a:core/designsystem/src/main/res/values/strings_explainer.xml`.
- C7 account-safety APIs:
  `/srv/gimhq/gim-client-sdk/docs/plan/20261023-0930-account-safety-features.md`.
  Phase A landed in gim-client-sdk 0e45604 during this campaign (see
  Decisions); the UI for it is not in this plan.
- C8 contact QR code (workspace coordinator, 2026-10-23): "My QR code"
  (Settings > Profile) encodes the plain Account ID only (`u` + 55
  characters, no URL or prefix); "Scan QR code" next to the username search
  in New chat accepts any scanned text containing a valid Account ID token
  and starts a chat with that user. Device linking keeps the SDK's link code.

Wording and structure reference for everything user-facing: the Android
plan `/srv/gimhq/gim-android/docs/plan/20261023-0755-product-ui-i18n-settings.md`.

Build environment: the station has Bun and Node but no Rust toolchain. Rust
and Tauri checks run in a sibling container built from `rust:1` with
webkit2gtk and the other Tauri Linux libraries plus Bun (image
`ai-agent/gim-win-gate`, label `ai-agent=true`, cargo cache
`/srv/.tmp/cache/cargo`, mounts `/srv/gimhq/gim-client-sdk` read-only and
the checkout itself at the same path). A Windows build is not required to
merge; a Windows 11 VM (`/srv/win11`, RDP 3389) is optional for manual
checks. The GitHub repository does not exist yet; nothing is pushed.

## Proposal

Feature baseline = the gim-mac baseline of
`/srv/gimhq/gim-core/docs/plan/20261022-repo-split-client-sdk-mac-web.md`
(Phase 6) minus the Apple-only items (multiple windows, Quick Look, APNs,
menu bar, Sparkle), plus the shared wording, settings and languages. Four
workstreams with disjoint write scopes; the first lands the skeleton and the
gate before the others branch.

### W1 Shell, SDK bridge and gate (lands first)

- Tauri 2 project: `src-tauri/` (Rust crate `gim-win`, `tauri.conf.json`,
  capabilities, icons), frontend at the repo root (`package.json`,
  `vite.config.ts`, `src/`), Bun lockfile, `.gitignore`, `.editorconfig`.
- Rust bridge `src-tauri/src/bridge/`: one `GimClient` per process held in
  Tauri state; a Tauri command per `GimClient` method of `docs/API.md`
  (camelCase on the JS side, same arguments and return shapes, `GimError`
  variants serialised with their name and fields); platform hooks
  (credential store, data dir, reachability, `LocalTimeZone` from the OS
  zone); listeners forwarded as events `chat-list-diff`,
  `timeline-diff` (payload carries `chatId`), `connection-state`, `typing`,
  `hub-list`, each delivering the diff batches in order; `localStateReset`
  surfaced at startup. Callbacks never call back into the client (see
  *Threading of platform callbacks*).
- Frontend baseline (pma-web): `src/app/` with router, providers, theme
  (light, dark, system), `src/components/ui/` shadcn base-nova, `src/lib/`
  (`api.ts` typed invoke wrappers and event subscriptions mirroring the
  bridge, `shortcuts.ts` keyboard shortcut registry, `format.ts` dates and
  sizes), `src/i18n/` with per-feature namespaces
  (`locales/{en,zh-CN,zh-TW,es}/{common,onboarding,account,chat,settings}.json`)
  and a test asserting every namespace has the four languages with identical
  key sets; route placeholders for `/onboarding/*`, `/chats`,
  `/chats/$chatId`, `/settings/*` (one file per C4 section) so later
  workstreams fill bodies without touching each other's files.
- Gate: `scripts/gate.sh` runs frontend lint, typecheck, test, build; Rust
  `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`,
  `cargo test`; and a Tauri debug build of the backend
  (`cargo build` in `src-tauri`) inside `ai-agent/gim-win-gate`
  (`docker/gate.Dockerfile`). `scripts/dev-hub.sh` starts a gim-hub
  container the way `gim-client-sdk/scripts/integration-test.sh` does
  (`GIM_HUB_SRC=/srv/gimhq/gim-hub`) for manual runs and later integration
  tests. README documents all of it.

### W2 Onboarding and account

- Onboarding routes: welcome with the three intro pages (no phone number,
  account lives on your devices, messages are locked), then **Link to
  existing device** first (QR from `startLink`, waiting state, SAS compare
  and confirm on this device, failure and retry per *Identity and devices*),
  **Create account** (name first; server step skipped when a default server
  is configured, "Use another server" link), recovery kit screen (account ID
  and recovery key together, copy, save as text file, last-4 check),
  username step, **Restore** (paste the kit text into one field, parsed
  label-independently; two separate fields as fallback; `revokeOthers`
  choice).
- Recovery kit commands: `src-tauri/src/recovery_kit.rs` wraps the SDK's
  `format_recovery_kit`, `parse_recovery_kit`, `recovery_key_ending` and
  `matches_recovery_key_ending` as thin commands; round-trip tests through
  the SDK functions with the labels of each language.
- Account features `src/features/account/`: Profile (name edit, username
  claim / change / remove, account ID copy, "My QR code" encoding the plain
  Account ID per C8), Account and devices (recovery key
  explanation, "Create a new recovery key" via `rotateRecoveryCode`, linked
  devices with remove, link a new device by scanning or pasting the other
  device's QR string: `approveLink` and `confirmApproval`). Owns the route
  bodies `settings/profile` and `settings/devices`.
- i18n namespaces `onboarding` and `account` in the four languages.

### W3 Messaging, media and search

- Chat list sidebar (`src/features/chats/`): rows from the chat list diffs
  applied in order (avatars with initials and stable colours, last message,
  relative time, unread badge, send-state ticks, chat state), New chat
  (username search, "Scan QR code" accepting any text with a valid Account
  ID token per C8), group creation, empty state.
- Chat pane: virtualised message list with infinite scroll backwards
  (`paginateBackwards` ahead of the top), date separators, membership
  changes, grouping by sender and time, reply, edit, delete, reactions,
  read receipts and typing, retry and cancel for failed sends, composer
  with Enter to send and Shift+Enter for newline, attachment picker, drag
  and drop of files and images onto the pane and paste of images from the
  clipboard (`sendMedia`), image and file bubbles with thumbnail and
  download (`fetchThumbnail`, `fetchMedia`), members sheet, leave chat.
- Link previews client-side: `src-tauri/src/preview.rs` fetches the page
  with a bounded size and timeout, parses Open Graph and title, caches per
  URL, never contacts the hub; command `fetchLinkPreview`.
- Search: `src-tauri/src/search.rs` indexes decrypted message bodies of
  loaded timelines and chat names in a local SQLite FTS table under the app
  data directory (cleared on sign out); command `search(query)` returns
  chats and messages; the UI opens the chat and scrolls to the message.
- Keyboard shortcuts: Ctrl+K search, Ctrl+N new chat, Ctrl+Up / Ctrl+Down
  previous and next chat, Esc back, Ctrl+F in-chat search.
- i18n namespace `chat` in the four languages.

### W4 Settings, languages and system integration

- Settings shell (`src/features/settings/`, route `settings.tsx` layout
  with the section list, entered from the avatar in the chat list header)
  and the sections Notifications (enable, sound, preview text, open the
  Windows notification settings), Appearance (theme, font size), Language
  (picker, persisted, applied without restart), Advanced (servers: list
  with state Connected / Not checked, add, remove, make main; from `hubs`,
  `addHub`, `removeHub`, `setPrimaryHub`, `hubList`), Help and about ("How
  gim works" explainer, app and core version via `coreVersion`, licences),
  Sign out (confirm dialog saying the recovery kit is needed to come back).
  C7 entries (profile photo, mute / pin / archive, read-receipt and typing
  switches, blocked users, delete account) exist in the layout behind a
  feature flag that is off.
- System integration `src-tauri/src/system/`: notifications for new
  messages while the window is unfocused or hidden (`tauri-plugin-
  notification`), taskbar badge with the unread count (overlay icon on
  Windows; no-op elsewhere), tray icon with show / hide / quit and
  close-to-tray, launch at login (`tauri-plugin-autostart`), window state
  persistence, single instance.
- Languages: `src/i18n/` runtime (detect the OS language, fall back to en,
  persisted choice), the `common` and `settings` namespaces in the four
  languages, date and number formatting per locale, and the completeness
  test kept green for every namespace.
- App-level shortcuts: Ctrl+, settings, Ctrl+Q quit, Ctrl+W hide to tray.

### Dependencies approved with this plan

`jsqr` (QR decoding of a pasted or chosen image, frontend, for linking a
device and the contact QR), `gim-ffi` from gim-client-sdk by path (the SDK's own `GimClient` facade; it
brings `uniffi` as its dependency, which gim-win never lists or generates
bindings with), `chrono` (DST-aware local offsets for `LocalTimeZone`),
Tauri 2 core and CLI, `tauri-plugin-notification`, `tauri-plugin-autostart`,
`tauri-plugin-dialog`, `tauri-plugin-clipboard-manager`,
`tauri-plugin-opener`, `tauri-plugin-single-instance`,
`tauri-plugin-window-state`, `keyring` (credential store), `reqwest` (shared
with the SDK, link previews), `scraper` or an equivalent HTML parser,
`rusqlite` (shared with the SDK, search index), `qrcode`, `serde`,
`tokio`, `tracing`; frontend: the pma-web baseline set, `@tanstack/react-
virtual`, `i18next` + `react-i18next`, `qrcode.react` or equivalent,
`@tauri-apps/api` and the plugin JS packages. Anything outside this list is
a deferred item for the user.

### Verification

- Linux gate (`scripts/gate.sh`) on every branch before merge: frontend
  lint, typecheck, Vitest, build; Rust fmt, clippy `-D warnings`, test;
  Tauri debug build.
- Unit tests written first for the recovery kit (Rust), the diff appliers
  and view models (Vitest), the link preview parser, the search index, the
  i18n completeness check.
- Manual run against a local gim-hub (`scripts/dev-hub.sh`) with the Linux
  build: onboarding by linking from the CLI client (`gim-client-sdk/apps/gim-cli`),
  a direct chat with text, image and file, search, settings in every
  language.
- A GitHub Actions `windows-latest` job (Rust + Bun, `cargo tauri build
  --debug`) is added once the repository exists and pushes are approved;
  not part of this campaign's merge gate.

## Campaign

- campaignId `l1-0xhhlawj-20261023095300`, L1 issue `lideea0t` (project
  `8l5uahun`), auto mode, watchdog cron `l1-auto-lideea0t` (`*/30`, id `ozm3gyo1`).
- Merge order: W1, then W2, W3, W4 in the order they finish (W2 before W4
  when both are ready, because the settings layout links to W2's routes).
  Actual: W1 (387f8a8), W4 (63b258f; ready before W2).
- Workstream ids, merge SHAs and decisions are appended below as they land.
- Decisions (auto mode):
  - 2026-10-23 10:3x, W1 yellow: the bridge depends on `bindings/gim-ffi`
    by path and wraps `gim_ffi::GimClient` instead of re-implementing the
    ~3,300 lines over gim-sdk/gim-ui, because it mirrors the API.md contract
    exactly and follows SDK changes through the path dependency; `chrono`
    provides DST-aware local offsets. Both added to the approved dependency
    list above. W1 cron `l2-dispatch-hi0yucfl` id `9a74kg9i`.
  - 2026-10-23 11:2x, W1 yellow: gim-client-sdk 0e45604 shipped the C7
    phase A methods (own profile and avatar, privacy switches, block, mute /
    pin / archive) and `ClientConfig.app_server_url`. The bridge exposes
    every GimClient method of the current API.md as thin commands and api.ts
    wrappers (W1-3, W1-6); no UI. The C7 UI stays behind W4's flag, off;
    turning it on is a scope decision deferred to the user. App server URL
    is a pass-through (`GIM_WIN_APP_SERVER_URL` / config `appServerUrl`).
  - 2026-10-23 11:4x, W1 batch 4: the bridge links gim-sdk, gim-store-sqlite
    and gim-ui through gim-ffi only; direct path dependencies are added only
    when the bridge uses a type from that crate (no artificial references).
  - 2026-10-23 11:5x, coordinator: C2 delivered in the SDK (04a02b5); W2's
    local parser criterion replaced by thin commands over the SDK functions.
    SDK b450ba0 also carries the Phase B APIs (app server, reportUser,
    deleteAccount); the app server is not deployed, entries stay hidden.
  - 2026-10-23 11:45, user decision j5sgwgsd option A (forwarded by the
    coordinator): `origin` = github.com/gimhq/gim-win (private); push main
    directly after each workstream merge once the Linux gate is green on
    main; never force-push; L2/L3 branches are not pushed.
- Pushes: 63b258f (W4 merge) and docs after it, by L1 at 20:5x;
  387f8a8 (W1 merge, pushed by the coordinator at repo creation);
  docs commits after it pushed by L1 at 11:48.
- 2026-10-23 11:54-15:15: every issue of this project stalled on the
  engine's account session limit (reset 15:00 UTC); W3's bootstrap turn was
  killed and resumed by L1; W1's idle countdown and W2/W4 bootstraps
  continued after the reset.
- Decisions (auto mode), continued:
  - 2026-10-23 15:21, W2 yellow: `jsqr` decodes QR images in the frontend
    (W2-7 scan-from-image); added to the approved list.
  - 2026-10-23 15:21: startSync/stopSync ownership assigned to W4 (shell
    starts sync once a session exists; may edit `_shell.tsx`, `network.ts`).
- 2026-10-23 15:21Z: a container sweep by another lane removed shared
  labelled containers; L2s treat gate deaths at that time as reruns, and
  every L3 now removes only containers it created and named.
- 2026-10-23 17:56Z-20:00Z: second session-limit stall; all sessions killed.
  20:15Z recovery: each L2 woken with its killed L3s named; W1 told to
  terminate without the rest of its idle countdown.
- Deferred to integration: the sign-out path calls W3 `searchReset` once W3
  and W4 are both on main (W3 owner check covers it meanwhile). W3 adds the
  asset protocol (scope limited to app cache and app data) and a staging
  command for pasted images.
- Merge rule: the generated licences list has a staleness test; every L2
  merges main and runs `bun run licences` (once main has it) before
  reporting ready, and L1 re-checks it at each main merge.
- 2026-10-23 20:30: server capacity 50/50 (all lanes). L1 terminated the
  idle sessions of 13 L3s already merged into their L2 branches (status
  stays review) and closed W1; 13 slots free afterwards.
- Integration rule: whichever of W3 and W4 merges last switches the badge
  to W3's `selectTotalUnread` and wires `searchReset` into sign out;
  shortcuts are installed once, in W4's system integration.
- Open decision `tij45g3c` (21:00): extend the L1 turn budget from 40 to 70
  (recommended) or stop at 40.
- Follow-on (W3, after the campaign): contract C9, chat-list ticks from the
  SDK's `MessagePreview.sendState` once that SDK build lands.

| workstream | L2 issue | state | merge |
|---|---|---|---|
| W1 shell, bridge, gate | `hi0yucfl` | terminated (cron deleted, verified 404); W1 and its 6 L3s moved to done 20:30 | merged 387f8a8 (base c3a79da); L1 gate on main green; pushed |
| W2 onboarding and account | `592kjjmc` | cron `ovu47d3z`; W2-1..W2-7 merged; W2-8 merging main (W4) running, then branch ready | |
| W3 messaging, media, search | `ep5orc1e` | cron `rziacfcn`; 7 of 10 L3s merged; W3-7 composer running; W3-8, W3-10 queued | |
| W4 settings, languages, system | `rt71em0g` | branch ready 54d2761 (7 L3s); L2 in idle countdown | merged 63b258f (base cc90e56); L1 gate on main green (204 Vitest, 41 Rust); pushed |

## Risks

- gim-client-sdk is being edited by issue `741tkpe2` (its `Cargo.toml` is
  dirty); the path dependency follows its working tree, so an SDK change
  can break the bridge mid-campaign. Mitigation: the bridge mirrors
  `docs/API.md`, and SDK-side needs are reported, never fixed here.
- Tauri on Linux needs webkit2gtk in the gate image; the first image build
  is slow and the cargo cache is shared with other projects.
- No Windows build in the gate: Windows-only code paths (credential store,
  overlay badge, autostart) are compiled only behind `cfg(windows)` and
  verified manually later.
- Three workstreams edit `src-tauri/src/lib.rs` (command registration) and
  `src-tauri/Cargo.toml`; conflicts are expected to be trivial and are
  resolved by L1 at merge time.
- Translations are machine-drafted and need native review before release.

## Scope

In: W1 to W4 above, in this repository only. Out: code signing, installers,
store distribution, auto-update, multiple windows, Quick Look-style
previews, the C7 features behind the flag, SDK changes (reported to the
gim-client-sdk owner), any `git push`.

## Alternatives

- WinUI 3 / C# through a C# UniFFI generator: native look, but new binding
  work and no shared web UI; rejected by the coordinator's recommendation.
- Electron with a Node binding: the binding does not exist yet.

## Annotations

(none)
