#!/usr/bin/env bash
# Replace the CRA preset command `react-scripts build` with craco
# (frontend uses webpack alias `@/` from craco.config.js).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# When copied to node_modules/.bin, the app root is two levels up.
if [[ -f "$HERE/../../package.json" && -f "$HERE/../../craco.config.js" ]]; then
  APP="$(cd "$HERE/../.." && pwd)"
elif [[ -f "$HERE/../package.json" && -f "$HERE/../craco.config.js" ]]; then
  APP="$(cd "$HERE/.." && pwd)"
else
  echo "react-scripts wrapper: cannot find frontend package.json from $HERE" >&2
  exit 127
fi

cd "$APP"
export CI="${CI:-false}"

if [[ "${1:-}" == "build" ]]; then
  shift
  exec npm run build -- "$@"
fi

REAL="$APP/node_modules/react-scripts/bin/react-scripts.js"
if [[ -f "$REAL" ]]; then
  exec node "$REAL" "$@"
fi

echo "react-scripts wrapper: missing react-scripts and unsupported args: $*" >&2
exit 127
