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
[ $rc -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
exit $rc
