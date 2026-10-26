# 20261026-0600-built-in-servers Built-in hub and keep server defaults with a Keep server setting

- **status**: implementing
- **createdAt**: 2026-10-26 06:00
- **approvedAt**: 2026-10-26 (user, via the workspace coordinator: follow-on round "built-in servers", auto mode, decision j5sgwgsd covers commit and push after a green gate)
- **relatedTask**: 20261026-0600-built-in-servers

## Context

- `src-tauri/src/bridge/config.rs` resolves the hub URL and the keep server
  URL as env (`GIM_WIN_SERVER_URL`, `GIM_WIN_KEEP_SERVER_URL`) >
  `<appData>/gim/config.json` (`serverUrl`, `keepServerUrl`) > unset. Without
  a hub URL the startup creates no client and onboarding shows the server
  step (`src/features/onboarding/server-step.tsx`); with one, onboarding
  offers "Use another server".
- `src-tauri/src/bridge/mod.rs` (`create_client_bundle`) passes
  `keep_server_url` into `gim_ffi::ClientConfig` (optional; `None` = no
  settings backup, `report_user` fails). FFI unchanged at gim-client-sdk
  d2fae1c.
- Settings > Advanced shows the servers list
  (`src/features/settings/advanced/servers-section.tsx`). No Report UI exists
  in gim-win; none is added.
- Locales: en, zh-CN, zh-TW, es.

## Proposal

1. **Defaults, defined once** in `config.rs`: `BUILT_IN_SERVER_URL =
   "https://hub.g.im"`, `BUILT_IN_KEEP_SERVER_URL = "https://keep.g.im"`.
   Hub: env > config.json > built-in, so a client is always created and the
   onboarding server field (behind "Use another server") is pre-filled with
   the effective URL and editable. Changing the hub of a signed-in account is
   out of scope (sign out and onboard again).
2. **Keep resolution**: env > config.json > built-in. config.json is the
   user's store: absent key = default; a URL = custom; explicit JSON `null`
   or `"off"` = off (`ClientConfig.keep_server_url = None`). Env wins over
   the user's choice and the UI says so.
3. **URL rule** shared by hub and keep: `https://` with a host, or `http://`
   only for localhost, loopback and private-range IPs, `*.local` / `*.lan`,
   and single-label hosts (dev containers).
4. **Commands**: `keep_server` returns `{ url, source:
   "env"|"config"|"builtIn"|"off", defaultUrl, restartRequired }`;
   `set_keep_server_url(url)`, `reset_keep_server()`, `disable_keep_server()`
   write config.json; `restart_app()` restarts the process. A change applies
   when the client is next created; the UI offers "Restart now".
5. **Settings UI**: a "Keep server" card in Settings > Advanced (shadcn):
   current URL and state, Change (inline field with validation copy), Reset
   to default, Turn off (confirm), the env-override note, the restart
   prompt, and the footer line "Backs up your privacy settings and receives
   reports. Your data is encrypted." Strings in all four locales.
6. **Unreachable keep**: nothing else depends on it; the SDK only logs
   backup failures. Tests never contact keep.g.im or hub.g.im.

## Risks

- A built-in hub means a first launch always creates a client against
  hub.g.im; a wrong default would show only as an onboarding error, which the
  server field fixes.
- Tightening http to local hosts could reject a non-local http hub a tester
  uses; https is required there by design.

## Scope

In: `src-tauri/src/bridge/{config.rs,mod.rs,commands/lifecycle.rs}` (plus a
new command file if cleaner), `src/lib/api/`, `src/features/onboarding/`
(server step prefill), `src/features/settings/advanced/`, the settings and
onboarding locale files, README "Bridge conventions". Out: hub migration for
signed-in accounts, Report UI, SDK changes.

## Alternatives

- Apply keep changes live by recreating the client: possible through
  `recreate_client`, but it tears down subscriptions under the running UI;
  a restart is simpler and the spec allows it.

## Annotations

(none)
