#!/usr/bin/env bash
# Runs a disposable gim-hub for a gim-win dev session by delegating to
# gim-client-sdk's scripts/gim-hub-dev.sh with gim-win's defaults.
#
#   export GIM_WIN_SERVER_URL=$(scripts/dev-hub.sh start)
set -euo pipefail

usage() {
    cat <<'USAGE'
Usage: scripts/dev-hub.sh <start|stop|url|status|logs|ip|commit>

Wraps $GIM_SDK_SRC/scripts/gim-hub-dev.sh (default /srv/gimhq/gim-client-sdk)
with these defaults, each overridable from the environment:
  GIM_HUB_SRC=/srv/gimhq/gim-hub      gim-hub checkout the image is built from
  GIM_HUB_IMAGE=ai-agent/gim-hub      image tag (built on the first start)
  GIM_HUB_NETWORK=traefik             docker network
  GIM_HUB_NAME=ai-agent-gim-hub-win   container name (labelled ai-agent=true, --rm)

Commands:
  start   Build the image if needed, start the hub, wait for /healthz and
          print its URL as the last stdout line; stderr also gets the matching
          GIM_WIN_SERVER_URL=<url> hint. Reuses a running container.
  stop    Stop the container; no error if it is already gone.
  url     Print the running hub's URL; exit 1 if not running.
  status  Print running/stopped; exit 0 if running, 1 otherwise.
  logs    Pass through to docker logs.
  ip      Print the container IP on GIM_HUB_NETWORK.
  commit  Print the gim-hub commit the image was built from.

The URL (http://ai-agent-gim-hub-win:8080) resolves by container name from
containers on the traefik network, this station included. A Tauri window
running elsewhere needs GIM_HUB_PUBLIC_URL set to an address it can reach
(a published port, for example); when set, it is passed through unchanged
and the hub signs clients in at that URL only.
USAGE
}

case "${1:-}" in
    -h | --help | help)
        usage
        exit 0
        ;;
    start | stop | url | status | logs | ip | commit) ;;
    *)
        usage >&2
        exit 2
        ;;
esac

sdk=${GIM_SDK_SRC:-/srv/gimhq/gim-client-sdk}
hub_dev=$sdk/scripts/gim-hub-dev.sh
if [ ! -f "$hub_dev" ]; then
    echo "scripts/dev-hub.sh: $hub_dev not found; set GIM_SDK_SRC to a gim-client-sdk checkout" >&2
    exit 1
fi

export GIM_HUB_SRC=${GIM_HUB_SRC:-/srv/gimhq/gim-hub}
export GIM_HUB_IMAGE=${GIM_HUB_IMAGE:-ai-agent/gim-hub}
export GIM_HUB_NETWORK=${GIM_HUB_NETWORK:-traefik}
export GIM_HUB_NAME=${GIM_HUB_NAME:-ai-agent-gim-hub-win}

if [ "$1" = start ]; then
    url=$(bash "$hub_dev" start)
    echo "GIM_WIN_SERVER_URL=$url" >&2
    echo "$url"
else
    exec bash "$hub_dev" "$1"
fi
