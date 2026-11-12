# 20261112-2200-recovery-key-note-to-self Recovery key reveal, note to self, handle removal (phase B)

- **status**: completed
- **priority**: P1
- **owner**: bkd-l1/0xhhlawj
- **createdAt**: 2026-11-12 22:00

## Description

Phase B of campaign `l1-0xhhlawj-20261112-1924`, on gim-client-sdk
`2e2e5d4` (handles removed, `recovery_code()`, `ChatSummary.is_note_to_self`).

- Every handle field, mapper and fixture is gone.
- Settings > Account and devices > View recovery key: device authentication
  (`authenticate_device`), then `recovery_code`; the key with copy, save and
  the kit QR code under capture protection, hidden when leaving the screen
  or the app; "This device doesn't have your recovery key" offers the
  rotation flow with the kit check.
- Note to self pinned on top, titled and badged; opened from New chat and
  Settings > Profile.

Acceptance: full `scripts/gate.sh` green on main, pushed to origin.

## ActiveForm

Adding the recovery key reveal and the note to self

## Dependencies

- **blocked by**: 20261112-1924-one-name-onboarding
- **blocks**: (none)

## Notes

- Windows-only code (`src-tauri/src/system/secure_view/windows.rs`) is
  type-checked and clippy-clean for `x86_64-pc-windows-msvc` in a scratch
  crate; it has not run on Windows.
