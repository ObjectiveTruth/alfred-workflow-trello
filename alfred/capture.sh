#!/bin/bash
# Keep input in argv, never interpolate captured text into shell source.
result=$(./bin/trello-inbox add "$1" --json)
status=$?
if [ "$status" -ne 0 ]; then
  printf '%s' "$1" | /usr/bin/pbcopy
elif [ -n "$tin_cache" ]; then
  # Next search must include the card just created, rather than an older snapshot.
  rm -f "$tin_cache/index.json" "$tin_cache/attempt"
fi
/usr/bin/osascript -l JavaScript ./notification.js "$status" "$result" "$1"
