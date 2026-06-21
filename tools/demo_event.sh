#!/usr/bin/env bash
# Trigger a scripted infestation spike on a demo node (drives detect→fuse→alert,
# and with the node armed + confirmed, the full dose loop). On-stage convenience
# so there's no live typing.
#
#   tools/demo_event.sh [device_id] [cycles] [backend]
#   tools/demo_event.sh PG-DEMO-105 15
set -eu
DEV="${1:-PG-DEMO-105}"
CYCLES="${2:-15}"
BACKEND="${3:-http://localhost:4000}"
curl -s -X POST "$BACKEND/api/v1/system/demo-event" \
  -H 'Content-Type: application/json' \
  -d "{\"device_id\":\"$DEV\",\"cycles\":$CYCLES}"
echo
