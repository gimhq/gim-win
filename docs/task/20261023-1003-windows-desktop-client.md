# 20261023-1003-windows-desktop-client Windows desktop client baseline (Tauri 2)

- **status**: completed
- **priority**: P1
- **owner**: bkd-l1/lideea0t
- **createdAt**: 2026-10-23 10:03

## Description

Build the gim Windows desktop client from the empty repository to the
Telegram-Desktop-class baseline shared with gim-mac: Tauri 2 shell over
gim-client-sdk, React + Vite frontend, onboarding (link first, create,
restore with the recovery kit), chat list and chat pane, media, search,
settings in the shared information architecture, four languages, system
notifications, tray mode and launch at login. Plan:
`docs/plan/20261023-1003-windows-desktop-client.md`.

Acceptance: every workstream of the plan merged into `main` with the Linux
gate green (`scripts/gate.sh`), the contract items C1 to C4 true for this
client, and C7 entries present but hidden.

## ActiveForm

Building the Windows desktop client baseline

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

- Driven by the BKD three-tier campaign `l1-0xhhlawj-20261023095300`, lane
  L1 issue `lideea0t` in project `8l5uahun` (auto mode). Workstream ids and
  merge SHAs are recorded in the plan's Campaign section.
- No `git push` until the workspace coordinator forwards the user's answer
  on creating `github.com/gimhq/gim-win` (message `j5sgwgsd`).

- complete: All four workstreams merged into main (W1 387f8a8, W4 63b258f, W2 9cbcae4, W3 9695c99); Linux gate green on main; pushed to origin.
