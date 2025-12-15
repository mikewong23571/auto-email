# CLI Guide

## Purpose
- `cli` hosts a small Go-based command-line client for the Cloudflare Mail Cleaner API.
- Commands mirror the `/api/messages` routes: list, latest, get, delete, batch-delete.

## Setup
- `cd cli` then `go build -o mailcli` or `go run . [command]`.
- The CLI defaults to `https://auto-email.styleofwong.com/api` and reads `API_TOKEN` for authentication.

## Commands
- `list --to EMAIL [--q QUERY] [--limit N] [--offset N] [--json]` — pagination + search.
- `latest --to EMAIL [--n N] [--json]` — newest messages.
- `get --json MESSAGE_ID`, `delete --json MESSAGE_ID`, `batch-delete --json ID...`.
- `--json` prints the full API response for scripting.

## Customization
- Override base URL with `--base` or `API_BASE`.
- Override token via `--token` or `API_TOKEN`.

## Testing
- `go test ./...` (none today) or `go run . list --token ... --json` to verify connectivity.
