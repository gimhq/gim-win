# 20261112-1924-one-name-onboarding App icon, one-name onboarding, no username UI (phase A)

- **status**: completed
- **priority**: P1
- **owner**: bkd-l1/0xhhlawj
- **createdAt**: 2026-11-12 19:24

## Description

Phase A of campaign `l1-0xhhlawj-20261112-1924` (user decisions 2026-11-12):
usernames are removed, the Account ID is the only identity; onboarding asks
for the display name only; the app icon comes from gim-static.

- Tauri icons regenerated with `bun tauri icon` from
  `gim-static/public/png/app-icon.png` (the app shows no in-app logo).
- Create account: name -> kit -> done; the username step and its strings are
  gone.
- Profile has no username row; New chat and group members take an Account ID
  (paste or QR) only; no "@username" anywhere.
- The bridge commands `claim_handle`, `release_handle`, `find_user` and their
  frontend wrappers are removed.

Acceptance: full `scripts/gate.sh` green on main, pushed to origin.

## ActiveForm

Removing username UI and replacing the app icon

## Dependencies

- **blocked by**: (none)
- **blocks**: phase B (re-vendor the SDK without handles, recovery key
  reveal, note to self)

## Notes

- `Session.handle` and `UserProfile.handle` stay in the serde mirrors
  (`src-tauri/src/bridge/types.rs`, `src/lib/api/types.ts`) until the SDK
  drops the field; nothing reads them.
