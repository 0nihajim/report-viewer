#!/usr/bin/env bash
# Typecheck the Worker source and report the result unambiguously.
set -uo pipefail
cd "$(dirname "$0")/.."
./node_modules/.bin/tsc --noEmit
code=$?
if [ "$code" -eq 0 ]; then
  echo "TYPECHECK_OK"
else
  echo "TYPECHECK_FAILED code=$code"
fi
exit "$code"
