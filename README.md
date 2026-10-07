# Trello Inbox

[![Release](https://github.com/ObjectiveTruth/alfred-workflow-trello/actions/workflows/release.yml/badge.svg)](https://github.com/ObjectiveTruth/alfred-workflow-trello/actions/workflows/release.yml)

Fast capture from Alfred into one Trello list. Type
`tin Buy more packaging material` and press Enter. Matching cards appear below
Create; select one to open it in your browser. Trello is where you triage and
organize.

**No npm, Node.js, or Deno installation is required to use the released Alfred
workflow. Deno is only used to build the standalone executable included in the
workflow.**

## Install

Requires **Apple Silicon macOS and Alfred 5+ with Powerpack**. Intel Macs,
Windows and Linux are not supported in this first version.

1. Open the
   [latest release](https://github.com/ObjectiveTruth/alfred-workflow-trello/releases/latest).
2. Download and open `Trello-Inbox.alfredworkflow`.
3. Enter your Trello API key, API token and inbox list ID in Workflow
   Configuration.
4. Type `tin Something I need to remember` in Alfred, then press Enter.

Success is shown only after Trello confirms card creation. A failed capture
copies the original input to the clipboard and displays an error. If a request
times out, check your list before retrying: Trello may have accepted the card
even if the response was lost. There are no automatic retries.

This is an initial personal-use release. The executable is not Developer ID
signed or notarized; some Macs may require explicit approval in Privacy &
Security. Do not disable Gatekeeper globally. Signing/notarization is a future
release-hardening task.

## Trello configuration

Follow Trello's
[API introduction](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/)
to create a Power-Up/API key and generate a token for that key. Click the
**Token** link on its Trello Auth page and authorize **read and write** access.
The user token is different from the application's **Secret**; this workflow
does not use that Secret. Its account must have access to your chosen list and
board.

| Alfred field     | CLI environment variable | Value                             |
| ---------------- | ------------------------ | --------------------------------- |
| Trello API Key   | `TRELLO_API_KEY`         | Your API key                      |
| Trello API Token | `TRELLO_API_TOKEN`       | A token authorized for that key   |
| Inbox List ID    | `TRELLO_LIST_ID`         | The target list's 24-character ID |
| Capture Keyword  | Alfred only              | Defaults to `tin`                 |

To find the list ID, open a card already in the target list in Trello and append
`.json` to the card URL; use its `idList` value. Alternatively use Trello's
[board lists endpoint](https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-lists-get).
The board ID, card ID, list name and list URL are not substitutes for the list
ID.

Configure once. Each capture goes directly to that list without opening Trello
or asking which board to use. Configuration defaults in this repository are
blank.

## Capture and find

```text
tin call RBC

  Create “call RBC”
  Add to Inbox

  Call RBC about business account requirements
  Next · Open in Trello
```

Create is always first, even for an exact match. **Enter** creates your text in
the configured list; **Down, Enter** opens an existing card. The capture
subtitle uses your configured list's actual name once loaded. Matches show their
list name only, with no project metadata. **Bare `tin`, Enter** opens the board
containing your Inbox in your browser. This also works with your custom keyword
(for example, `trello`). Blank or whitespace-only input never creates a card.
The board address loads on first use and is cached for subsequent visits; if it
cannot load, the workflow shows an unavailable message.

Search covers non-archived cards in non-archived lists on the **same board as
your Inbox**. It matches title words in any order, ignores case/accents, ranks
exact titles and phrases first, and returns up to five matches. It does not
search other boards or modify existing cards.

The adapter refreshes a local index in the background, at most once per minute.
Create never waits for the network. On first use matches appear when loading
finishes. Once results are displayed they stay fixed until you change the query
or start a new Alfred session, preventing selection from shifting under your
cursor. A successful capture invalidates the index for the next search.

Search failures display **Search unavailable** or **Search could not refresh**
with saved results; they are never presented as a successful empty search. A
token without read permission may still create cards but cannot search them.
Search and capture failures are handled independently.

## Updates

Run `tin-update` to query this repository's latest GitHub Release. Select an
available update to download it and open Alfred's import/update dialog. The
update keyword stays `tin-update` even if you customize the capture keyword.

The stable Bundle ID is `ca.miguelmendez.alfred.trello-inbox`. Alfred stores
user configuration separately in `prefs.plist`; packages contain no preferences
and keep the same configuration variable names across upgrades. See the manual
upgrade acceptance check below. Normal capture never contacts GitHub.

## Develop locally

Build tools: Apple Silicon macOS, Deno **2.9.5**, Git, and macOS's bundled
`plutil`, `zip`, `unzip`, `file`, Bash and JXA (`osascript`). No third-party
Deno or npm imports are used. The lockfile is intentionally empty. CI pins the
same Deno version.

```sh
deno test
deno task check
deno task build
deno task package
deno task smoke
open dist/Trello-Inbox.alfredworkflow
```

Output: `dist/trello-inbox`, `dist/Trello-Inbox.alfredworkflow` and
`dist/checksums.txt`. Builds and exported workflow archives are ignored by Git.
The executable has permission only for network access to `api.trello.com` and
the three Trello environment variables. No file or subprocess access is granted.

The same executable works independently in Terminal after you set those three
environment variables using your preferred local secret management:

```sh
./dist/trello-inbox add "Buy cardboard"
./dist/trello-inbox add "Buy cardboard" --json
./dist/trello-inbox index --json
```

Quote the entire title as one argument. JSON results go to stdout, including
failures. Plain-text failures go to stderr. Exit codes: `0` success, `1` runtime
error, `2` configuration/input, `3` authorization, `4` API/network/response
error. Production does not read `.env` files. Never paste secrets into tracked
files.

### Editing the Alfred canvas

Edit in Alfred, export the workflow, then run:

```sh
deno task import-alfred ~/Downloads/Trello-Inbox.alfredworkflow
deno task check
git diff -- alfred/
```

The helper verifies the Bundle ID, imports only `info.plist` and `icon.png`,
clears Trello credential/list defaults, and ignores `prefs.plist`, bundled
binaries and scripts. Edit adapter scripts directly in Git. New distributable
resources need an explicit addition to the package allowlist in
`scripts/common.ts`. Review the export's scripts and metadata before committing;
an arbitrary export is executable code. There is no automatic synchronization
from Alfred into this repository.

## Architecture

`src/` contains a standalone CLI and Trello API client with injected
configuration and HTTP dependencies. Authentication is a header-provider
boundary. The core does not know about Alfred.

`alfred/` is the frontend: Script Filter → create/open action. Its JXA renderer
searches a local index while a separate shell worker calls the CLI's read-only
index command. Capture invokes the CLI and formats a confirmed notification;
opening invokes the system browser. It uses relative paths and macOS system
tools. `update.sh` is an independent, pinned GitHub updater; provenance, license
and review notes are in [UPDATER.md](alfred/UPDATER.md).

`scripts/` validates metadata and obvious accidental secrets, compiles only
`aarch64-apple-darwin`, and packages an explicit allowlist. Importing an export
never replaces the core or vendored updater.

## CI and releases

Pull requests and non-main pushes run CI. Every main push runs the same reusable
CI job through the Release workflow: formatting, lint, type checks, mocked
tests, metadata checks, compilation, packaging and executable/adapter smoke
checks. CI also saves a downloadable workflow artifact.

`alfred/info.plist` is the version source of truth. To release, update its
`version` to a new stable SemVer (`X.Y.Z`), add a changelog entry, and
merge/push to `main`. After checks pass, Actions tags the tested commit and
publishes `Trello-Inbox.alfredworkflow` plus `checksums.txt`. If the tag already
exists, Actions leaves the release untouched. A same-version source change
therefore does not update downloads. Fix a released issue with a new patch
version.

The Release workflow also supports manual dispatch on main. If a release upload
fails after tag creation, inspect the failed run before taking recovery action:
the workflow deliberately does not overwrite an existing tag or release.

### Acceptance checks

Automated tests mock Trello and require no credentials or network permission.
Smoke checks run the packaged binary with a minimal system PATH, check its ARM64
format, exercise notification formatting, and simulate updater responses. They
do not create cards, install workflows, or modify the clipboard.

These real Alfred/Trello checks require your local configuration and remain part
of the manual release checklist:

- **Fresh install:** import, configure, capture a card; confirm both the card
  and success notification.
- **Missing configuration:** clear configuration, capture text; confirm
  actionable notification and original text on the clipboard.
- **Upgrade preservation (mandatory):** configure an installed older version,
  install a higher-version package with the same Bundle ID, verify credentials,
  list ID and custom keyword remain, then create a card successfully.
- **Update discovery:** from an older version run `tin-update`, select the newer
  release, and confirm Alfred opens the import/update dialog.

## Privacy and security

Credentials are supplied at runtime, sent to Trello in an authorization header,
and never included in diagnostic messages. The executable contains no personal
IDs or secrets. Alfred stores the configured values locally; Keychain
integration is not implemented. Failed capture text replaces the clipboard for
recovery.

The search adapter stores card titles, card URLs, list names and the board name
and URL in Alfred's local workflow cache with owner-only permissions. It keeps
no descriptions, attachments or credentials there. Configuration changes use a
separate cache namespace. The standalone executable still has no filesystem or
subprocess permissions; cache management belongs to the macOS adapter.

Packages exclude `prefs.plist`, `.env*`, source files and signing material by
construction. CI checks are useful guardrails, not a substitute for reviewing a
diff for secrets. The updater contacts GitHub only on request and is not
downloaded dynamically. Released checksums can be checked manually with
`shasum -a 256 -c
checksums.txt`; the updater does not yet verify them
automatically.

## License

MIT; see [LICENSE](LICENSE). Vendored updater copyright and license are retained
in [UPDATER-LICENSE](alfred/UPDATER-LICENSE). This is an independent workflow,
not an official Trello or Alfred product.
