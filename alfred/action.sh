#!/bin/bash
case "$1" in
  create) exec ./capture.sh "$2" ;;
  open)
    case "$2" in
      https://trello.com/c/*) /usr/bin/open "$2" ;;
      *) exit 2 ;;
    esac
    ;;
  *) exit 2 ;;
esac
