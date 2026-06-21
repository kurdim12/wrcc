#!/usr/bin/env bash
# Run all host-runnable Palm Guard tests. Exits non-zero if any fail.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
rc=0
echo "== device dose FSM failsafes =="
python3 "$here/test_device_fsm.py" || rc=1
echo
echo "== server-side dose caps =="
python3 "$here/test_server_caps.py" || rc=1
echo
echo "== intelligence layer (experts + fusion) =="
if command -v node >/dev/null 2>&1; then
  node --test "$here/test_intelligence.mjs" || rc=1
else
  echo "  (node not found — skipping JS expert tests)"
fi
echo
[ $rc -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
exit $rc
