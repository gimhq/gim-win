#!/usr/bin/env bash
# Runs the gim-win Linux gate inside the ai-agent/gim-win-gate image
# (docker/gate.Dockerfile): frontend install, lint, typecheck, test, build;
# then in src-tauri: cargo fmt --check, clippy -D warnings, test, build.
#
# The checkout is mounted at its own path (it must live under /srv so the
# host daemon sees it) and /srv/gimhq/gim-client-sdk is mounted read-only
# for the path dependencies of src-tauri/Cargo.toml.
#
# Env: GIM_WIN_GATE_REBUILD=1 rebuilds the image;
#      GIM_WIN_GATE_ONLY=frontend|rust runs one half (default: both);
#      GIM_CARGO_CACHE: CARGO_HOME mounted into the container (default
#      /srv/.tmp/cache/cargo); GIM_BUN_CACHE: Bun install cache (default
#      /srv/.tmp/cache/bun); CARGO_TARGET_DIR, when set, is mounted at the
#      same path so parallel checkouts share one target directory;
#      CARGO_INCREMENTAL and CARGO_TERM_COLOR are passed through when set.
set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
image=ai-agent/gim-win-gate
sdk=/srv/gimhq/gim-client-sdk
cargo_cache=${GIM_CARGO_CACHE:-/srv/.tmp/cache/cargo}
bun_cache=${GIM_BUN_CACHE:-/srv/.tmp/cache/bun}
only=${GIM_WIN_GATE_ONLY:-}

case "$only" in
    "" | frontend | rust) ;;
    *)
        echo "GIM_WIN_GATE_ONLY must be empty, frontend or rust (got: $only)" >&2
        exit 2
        ;;
esac

if [ "${GIM_WIN_GATE_REBUILD:-0}" = 1 ] || ! docker image inspect "$image" >/dev/null 2>&1; then
    echo "==> build image $image"
    docker build --label ai-agent=true -t "$image" -f "$repo/docker/gate.Dockerfile" "$repo/docker"
fi

mkdir -p "$cargo_cache" "$bun_cache"

docker_args=(
    --rm --label ai-agent=true
    -v "$repo:$repo" -w "$repo"
    -v "$sdk:$sdk:ro"
    -v "$cargo_cache:/cache/cargo" -e CARGO_HOME=/cache/cargo
    -v "$bun_cache:/cache/bun" -e BUN_INSTALL_CACHE_DIR=/cache/bun
    -e CARGO_INCREMENTAL -e CARGO_TERM_COLOR
    -e GIM_WIN_GATE_ONLY="$only"
)
if [ -n "${CARGO_TARGET_DIR:-}" ]; then
    mkdir -p "$CARGO_TARGET_DIR"
    docker_args+=(-v "$CARGO_TARGET_DIR:$CARGO_TARGET_DIR" -e CARGO_TARGET_DIR)
fi

read -r -d '' steps <<'STEPS' || true
set -euo pipefail
step() { echo; echo "==> $*"; }
if [ "$GIM_WIN_GATE_ONLY" != rust ]; then
    step "bun install --frozen-lockfile"; bun install --frozen-lockfile
    step "bun run lint"; bun run lint
    step "bun run typecheck"; bun run typecheck
    step "bun run test"; bun run test
    step "bun run build"; bun run build
fi
if [ "$GIM_WIN_GATE_ONLY" != frontend ]; then
    cd src-tauri
    step "cargo fmt --check"; cargo fmt --check
    step "cargo clippy --all-targets -- -D warnings"; cargo clippy --all-targets -- -D warnings
    step "cargo test"; cargo test
    step "cargo build"; cargo build
fi
echo; echo "==> gate passed"
STEPS

exec docker run "${docker_args[@]}" "$image" bash -c "$steps"
