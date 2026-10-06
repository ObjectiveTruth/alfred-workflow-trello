#!/bin/bash
umask 077
cache="$1"
pending="$cache/pending-$$.json"
trap 'rm -f "$pending"; rmdir "$cache/lock" 2>/dev/null' EXIT
if ./bin/trello-inbox index --json >"$pending" 2>/dev/null; then
  mv "$pending" "$cache/index.json"
  rm -f "$cache/error.json"
else
  # The CLI emits safe structured errors. Handle a crashed/missing executable too.
  if [ ! -s "$pending" ]; then
    printf '%s' '{"success":false,"error":{"message":"Search unavailable. Try again shortly."}}' >"$pending"
  fi
  mv "$pending" "$cache/error.json"
fi
