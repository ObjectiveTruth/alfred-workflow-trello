# Trello Inbox: context for future agents

## Purpose and product boundary

This repository, `ObjectiveTruth/alfred-workflow-trello`, contains one Alfred
workflow: **Trello Inbox**. It helps the user capture a thought into Trello or
find and open an existing card, with minimal interruption to their current work.

The user has tested both capture and the combined capture/search interaction and
confirmed that they work well. Preserve that simplicity when extending the
project.

The division of responsibilities is intentional:

- **Alfred:** create cards, search for cards, open cards in the browser.
- **Trello:** visual inbox processing, categorization, prioritization, and task
  management. The user prefers the real board for these activities.
- **Obsidian:** project knowledge and potentially read-only views of external
  tasks in the wider personal system.
- **Jira:** work deliberately handed over to a team/delivery workflow.

Obsidian and Jira are context, not implemented integrations or committed roadmap
items. Do not turn this workflow into a full Trello client or a synchronization
system without a new user request.

## Agreed interaction contract

The normal interaction uses one configurable keyword, defaulting to `tin`:

```text
tin call RBC

  Create “call RBC”
  Add to Inbox

  Call RBC about business account requirements
  Next · Open in Trello
```

These are illustrative titles and list names, not configuration defaults.

1. **For nonblank input, Create is always the first result.** Pressing Enter
   creates exactly the supplied title in the configured Inbox list. An exact
   existing match must not change the meaning of Enter.
2. **Existing matches appear below Create.** Down, then Enter opens the selected
   card in the browser. It does not modify, append to, or categorize that card.
3. **A match's subtitle is only `<list name> · Open in Trello`.** The user
   explicitly removed project metadata from this design. Do not assume custom
   project fields or labels exist. The Create subtitle uses the configured
   list's actual name once available, with `Inbox` as the loading fallback.
4. **Capture must not wait for search.** Render Create immediately; fetch search
   data separately. A search failure must not disable the capture action.
5. **Keep the selection stable.** Once matches are shown, freeze results for
   that query/session. Background refreshes must not swap the card under the
   cursor.
6. **Distinguish search failure from no matches.** Show an
   unavailable/stale-search message when appropriate. Never imply a failed
   search proved no card exists.
7. **Blank input cannot create a card.** Bare `tin` (or the configured keyword)
   and Enter opens the Inbox’s board in the browser. Whitespace-only input does
   the same; show loading/unavailable states when the board URL is not cached.
8. **Only confirmed creation is success.** Preserve nonzero error exits and
   useful notifications. Failed captures copy the original text to the
   clipboard. Do not blindly retry a POST: a lost response can follow a
   successful Trello write.

Search currently covers non-archived cards in non-archived lists on the same
board as the configured Inbox. It matches title words in any order, ignores case
and accents, prioritizes exact titles/prefixes/phrases, and shows at most five
matches. This is title matching, not semantic search. Categorization stays in
Trello.

`tin-update` is a separate explicit GitHub update check. Normal capture and card
search must never wait for GitHub or an Obsidian/Jira integration.

## Architecture and important files

- `src/cli.ts`: standalone CLI entry point; `add "Title" [--json]` and the
  read-only `index --json` command. Exit codes: 0 success, 1 runtime, 2
  configuration/input, 3 authorization, 4 API/network/response failure.
- `src/trello.ts`, `src/search.ts`, `src/config.ts`: Trello operations, board
  index loading, and runtime configuration. The core has no Alfred dependency.
  Keep authentication behind the header-provider boundary.
- `alfred/info.plist`: workflow canvas, configuration definitions, and version.
- `alfred/filter.sh`, `refresh.sh`, `filter.js`: background index refresh and
  JXA Script Filter rendering. The adapter owns filesystem/cache work and
  ranking.
- `alfred/action.sh`: routes the selected result to capture or browser opening.
- `alfred/capture.sh`, `notification.js`: invokes the CLI and formats
  notifications.
- `alfred/update.sh`: pinned, vendored updater; provenance and limitations are
  in `alfred/UPDATER.md`. Do not fetch executable updater code at runtime.
- `scripts/`: validation, compilation, allowlisted packaging, smoke checks, and
  importing Alfred exports. `scripts/common.ts` lists distributable files.
- `tests/`: mocked unit tests. JXA/packaged behavior is checked by smoke
  scripts.

Use TypeScript and Deno for the portable core. Support Apple Silicon macOS with
Alfred 5+ and Powerpack. Compile only `aarch64-apple-darwin` for now. End users
need no Deno, Node, npm, Homebrew, or Python installation; the ARM64 executable
ships inside the `.alfredworkflow`. Adapter scripts use bundled macOS tools and
relative workflow paths. There are currently no third-party Deno/npm imports.

The compiled executable is restricted to `api.trello.com` and the three Trello
environment variables, with no filesystem or subprocess permission. Keep Alfred
cache permissions in the adapter rather than broadening the core's permissions.
The cache contains card titles, links, list names and the board name/URL, not
credentials or full card contents. Successful refreshes are normally throttled
to 60 seconds; failures can retry after 15 seconds. A successful capture
invalidates the search index.

## Configuration and secrets

Required runtime variables: `TRELLO_API_KEY`, `TRELLO_API_TOKEN`,
`TRELLO_LIST_ID`. The configurable Alfred keyword is `capture_keyword`.

The **user token is not the application's Secret** on Trello's developer screen.
The user initially encountered this ambiguity. Guide users to the **Token** link
on the Trello Auth page and read/write authorization. This personal workflow
does not require implementing an OAuth callback. The list ID identifies the
destination list, not the board or a card.

Keep all credential/list defaults blank. Never commit or package real
credentials, personal IDs, `prefs.plist`, `.env*`, caches, generated binaries,
or signing material. Do not print credentials while debugging. When testing
saved configuration, load values locally and report outcomes rather than values.

Keep this Bundle ID stable: `ca.miguelmendez.alfred.trello-inbox`. Preserve the
configuration variable names and users' `prefs.plist` across upgrades. Packages
contain `info.plist` but never personal preferences.

## Development and local verification

Use macOS and the Deno version pinned in CI (`2.9.5` at the initial releases).
Read `deno.json` and the workflow files for current commands rather than
assuming this historical version will remain current.

For executable or adapter changes:

```sh
deno fmt
deno task check
deno task build
deno task package
deno task smoke
```

`check` covers formatting, lint, type checking, unit tests and
repository/metadata validation. `build` produces `dist/trello-inbox`; `package`
produces `dist/Trello-Inbox.alfredworkflow` and `dist/checksums.txt`. Smoke
tests exercise the packaged executable and JXA adapter without creating real
cards or needing secrets. Add meaningful regression coverage for changed
behavior, especially Create-first ordering, matching, selection stability, error
handling and configuration safety.

For documentation-only changes, check formatting and `git diff --check`; a local
binary rebuild is unnecessary. GitHub still runs its configured checks on
pushes.

To try a package in Alfred, open `dist/Trello-Inbox.alfredworkflow` and complete
the import/update. When local installation is part of the user's task, preserve
their existing setup. Alfred preferences may live in a custom sync folder:
discover it with
`defaults read com.runningwithcrayons.Alfred-Preferences syncfolder`, then
locate the workflow by Bundle ID. Do not hardcode a machine-specific workflow
UUID.

For the initial 0.2.0 iteration, we also updated the installed workflow's
distributable files directly for a quick local trial. If using that development
technique, back up the files being replaced, preserve `prefs.plist`
byte-for-byte, and replace `info.plist` last. A direct file update does not
substitute for testing Alfred's actual import/update flow when validating
distribution behavior.

Live validation should begin with read-only search/index requests and the
installed filter. Verify the Create row appears promptly, a known card matches,
list subtitles are correct, and preferences survive the upgrade. Keep real card
creation distinct from read-only checks; do not create surprise test tasks as
part of ordinary CI. Report exactly which automated, live API, and interactive
checks were performed.

## Editing the Alfred canvas

Git is the source of truth. There is no automatic synchronization from Alfred.
After visual edits in Alfred, export the workflow and run:

```sh
deno task import-alfred ~/Downloads/Trello-Inbox.alfredworkflow
deno task check
git diff -- alfred/
```

The importer verifies the Bundle ID, imports metadata/icon, clears private
defaults, and excludes preferences and binaries. Edit scripts in the repository;
an export does not replace them. Add any new distributable resource to the
explicit package allowlist. Review exported metadata/scripts before committing.

## GitHub delivery and releases

Repository: <https://github.com/ObjectiveTruth/alfred-workflow-trello>. The
integration branch is `main`. Follow the user's requested branch/delivery flow;
do not rename an existing workspace branch without an explicit request.

The initial sessions explicitly used direct pushes to main. When continuing that
authorized delivery flow from a workspace branch, `git push origin HEAD:main`
publishes the current commit without renaming/checking out the local branch.
Inspect remote changes first; do not force-push over somebody else's work.

For a downloadable workflow change:

1. Increase `version` in `alfred/info.plist` using stable SemVer and update
   `CHANGELOG.md`. Keep the Bundle ID unchanged.
2. Complete local checks/build/package/smoke verification.
3. Push/merge to main as requested and watch the GitHub Actions run.
4. The Release workflow runs reusable CI, then creates `vX.Y.Z` if its tag is
   absent. It attaches `Trello-Inbox.alfredworkflow` and `checksums.txt`.
5. Verify the release assets and distinguish publishing from installing locally.

Existing tags/releases are not overwritten. Fix a released build with a new
patch version. Documentation-only changes do not need a workflow version bump;
the release job skips publishing when that version's tag already exists. If a
run fails after creating its tag, inspect the failure before attempting
recovery.

## Decision history

- **0.1.0 — initial working draft, October 5, 2026 (user's local date).** The
  priority was proving the complete local build and GitHub distribution path
  with a minimal CLI. The public repo, ARM64 package, checks, releases and
  explicit updater were established. The user configured Trello and confirmed
  real capture worked.
- **UX correction before 0.2.0.** An agent proposed a separate management menu
  with Next/Doing/Waiting views, status changes and undo. The user explicitly
  preferred creating and finding/opening cards in Alfred, then using Trello for
  visual triage. The earlier proposal and broader capture-methodology document
  are not the product specification. Do not reintroduce that management scope by
  default.
- **0.2.0 — combined capture/search.** The user approved Create as the first
  result and existing cards below it, with only list names in their subtitles.
  Local and GitHub checks passed (43 unit tests plus package/adapter smoke
  checks at that point). Live read-only search found the expected card, and the
  local update kept preferences unchanged. The user subsequently tested the
  interaction in Alfred and reported that it worked perfectly.
- **0.3.0 — board shortcut.** The user requested bare `tin` (their custom
  keyword is `trello`) plus Enter to open the Inbox’s board. Cache its name and
  URL with the search index; keep capture/search unchanged for nonblank text.
- **This file** records the agreed intent and working development flow so future
  agents do not have to reconstruct them from chat attachments.

Keep this context current when an actual product decision changes. Use
`README.md` for end-user instructions, `CHANGELOG.md` for releases, and this
file for agent orientation. Private `.context/` attachments are not a required
dependency for understanding or building the public repository.
