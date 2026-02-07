# CLI Guide

## Purpose
- `cli` hosts a small Go-based command-line client for the Mailbox API.
- Commands mirror the `/api/messages` routes: list, latest, get, delete, batch-delete.

## Setup
- `cd cli` then `go build -o mailcli` or `go run . [command]`.
- The CLI defaults to `https://mailbox.styleofwong.com/api` and reads `API_TOKEN` for authentication.

## Build (Linux, CGO disabled)

```bash
cd cli
./build-linux.sh
```

## Commands
- `list --to EMAIL [--q QUERY] [--limit N] [--offset N] [--json]` — pagination + search.
- `latest --to EMAIL [--n N] [--json]` — newest messages.
- `get --json MESSAGE_ID`, `delete --json MESSAGE_ID`, `batch-delete --json ID...`.
- `--json` prints the full API response for scripting.

## Customization
- Override base URL with `--base` or `API_BASE`.
- Override token via `--token` or `API_TOKEN`.

### Token (required)

Use env var (recommended):

```bash
export API_TOKEN='REPLACE_WITH_YOUR_TOKEN'
```

You can also pass `--token` per command.

## Testing
- `go test ./...` (none today) or `go run . list --token ... --json` to verify connectivity.
