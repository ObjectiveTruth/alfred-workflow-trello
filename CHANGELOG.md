# Changelog

## 0.3.0

- Bare `tin` (or your custom keyword) and Enter opens your Inbox’s Trello board
  in the browser. Whitespace-only input also opens the board.
- Cache the board address with search data, with loading and unavailable states
  on first use. Capture and card search keep their existing behavior.

## 0.2.0

- `tin <text>` shows Create first, followed by matching cards on the Inbox's
  board. Press Enter to capture, or select a match to open it in Trello.
- Match subtitles show only the list name and “Open in Trello”.
- Background search keeps capture responsive; results stay fixed while
  selecting. Blank input cannot create a card, and search failures remain
  visible.
- Read-only `index --json` CLI command; credentials remain outside the cache.
- Clearer setup: use a user token with read/write access, not the app secret.

## 0.1.0

- Initial Apple Silicon Trello Inbox workflow and standalone Deno CLI.
- Capture into one configured list with confirmed success and actionable
  failures.
- Local build/package/import tooling and mocked tests.
- GitHub Actions validation and version-based GitHub Releases.
- Explicit `tin-update` command using a pinned, vendored updater.
