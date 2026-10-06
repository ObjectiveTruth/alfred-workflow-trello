#!/bin/bash
# Cache lives outside the distributable workflow and contains no credentials.
umask 077
cache_root="${alfred_workflow_cache:-${TMPDIR:-/tmp}/ca.miguelmendez.alfred.trello-inbox}"
# Separate users/configurations without exposing their values in file names.
fingerprint=$(printf '%s\0' "$TRELLO_API_KEY" "$TRELLO_API_TOKEN" "$TRELLO_LIST_ID" | /usr/bin/shasum -a 256)
cache="$cache_root/search-${fingerprint%% *}"
mkdir -p "$cache"
now=$(date +%s)
last=$(/usr/bin/stat -f %m "$cache/attempt" 2>/dev/null || printf 0)
ttl=60
[ -f "$cache/error.json" ] && ttl=15
if [ $((now - last)) -ge "$ttl" ]; then
  # A crashed worker must not leave a permanent lock.
  locked=$(/usr/bin/stat -f %m "$cache/lock" 2>/dev/null || printf 0)
  if [ -d "$cache/lock" ] && [ $((now - locked)) -gt 30 ]; then
    rmdir "$cache/lock" 2>/dev/null
  fi
  if mkdir "$cache/lock" 2>/dev/null; then
    touch "$cache/attempt"
    /usr/bin/nohup /bin/bash ./refresh.sh "$cache" </dev/null >/dev/null 2>&1 &
  fi
fi
exec /usr/bin/osascript -l JavaScript ./filter.js "$1" "$cache"
