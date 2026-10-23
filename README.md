# gim-win

Windows desktop client for gim: a Tauri 2 shell whose Rust side wraps
gim-client-sdk and exposes it to a React frontend through Tauri commands and
events. Benchmarked against Telegram Desktop; shares wording, settings layout
and languages with the other gim clients.

## Stack

- Tauri 2 (Rust bridge over `gim-sdk`, `gim-store-sqlite` and `gim-ui` from
  gim-client-sdk, currently a path dependency on `/srv/gimhq/gim-client-sdk`).
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

(documented by a later task)

## Dev hub

(documented by a later task)
