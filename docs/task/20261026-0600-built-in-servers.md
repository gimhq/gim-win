# 20261026-0600-built-in-servers Built-in hub and keep server defaults with a Keep server setting

- **status**: in_progress
- **priority**: P1
- **owner**: bkd-l1/lideea0t
- **createdAt**: 2026-10-26 06:00

## Description

Follow-on round "built-in servers" of campaign `l1-0xhhlawj-20261023095300`
(user-approved 2026-10-26: "可以做一个内置的hub和keep，然后用户可以change
server"). Built-in defaults hub `https://hub.g.im` and keep
`https://keep.g.im`, existing overrides first; the onboarding server field is
pre-filled and editable; Settings gains a Keep server entry (view, change,
reset, off). Plan: `docs/plan/20261026-0600-built-in-servers.md`.

Acceptance: the plan's acceptance list, full `scripts/gate.sh` green on main,
pushed to origin.

## ActiveForm

Adding built-in server defaults and the Keep server setting

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

- Implemented on the linked SDK at d2fae1c (FFI unchanged); a later SDK
  commit (delete_account continues when keep fails) is a separate re-vendor
  step forwarded by the workspace coordinator.
