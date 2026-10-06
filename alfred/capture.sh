#!/bin/bash
# Keep input in argv, never interpolate captured text into shell source.
result=$(./bin/trello-inbox add "$1" --json)
status=$?
if [ "$status" -ne 0 ]; then
  printf '%s' "$1" | /usr/bin/pbcopy
fi
/usr/bin/osascript -l JavaScript ./notification.js "$status" "$result" "$1"
