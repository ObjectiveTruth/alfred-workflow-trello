# Vendored updater

`update.sh` is copied without modification from
[grigoriev/alfred-workflow-updater](https://github.com/grigoriev/alfred-workflow-updater)
at commit `b68ca4a6bee3b2df5fcdd5706d8efc5439f1017c`. Its MIT license is
included in `UPDATER-LICENSE`.

Reviewed for this initial integration: the script uses macOS system commands,
queries GitHub over HTTPS with a timeout, compares the installed version,
downloads the workflow asset and opens it for Alfred's import confirmation. It
never reads Trello credentials and no updater code is downloaded at runtime. The
automatic background updater is deliberately not included.

Known limitations inherited from upstream: release JSON is parsed with text
tools, download failures do not display a notification, and asset
checksums/signatures are not verified automatically. The explicit updater action
receives only the URL from its Script Filter. Stable `X.Y.Z` releases are
supported here. Upstream updates must be reviewed, pinned, and tested before
replacing this file.
