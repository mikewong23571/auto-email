# Mailbox CLI

`mailcli` is a small command-line client for the Mailbox API.

## Help

The built-in help is the source of truth:

```bash
mailcli --help
mailcli help
mailcli help list
mailcli list --help
```

## Auth (token required)

Set the token via environment variable (recommended):

```bash
export API_TOKEN='REPLACE_WITH_YOUR_TOKEN'
```

Or pass it per command:

```bash
mailcli list --token 'REPLACE_WITH_YOUR_TOKEN' --to you@example.com
```

Security notes:
- Do NOT commit your token to git.
- If a token has been pasted into chat/logs, rotate it as soon as possible.

## Base URL

Defaults to production:

- `https://mailbox.styleofwong.com/api`

Override via env var:

```bash
export API_BASE='http://localhost:8787/api'
```

Or per command:

```bash
mailcli list --base 'http://localhost:8787/api' --to you@example.com
```

## Commands

List messages:

```bash
mailcli list --to you@example.com
```

Search (FTS):

```bash
mailcli list --to you@example.com --q 'invoice'
```

Latest N:

```bash
mailcli latest --to you@example.com --n 5
```

Get one message:

```bash
mailcli get <message_id>
```

Delete one:

```bash
mailcli delete <message_id>
```

Batch delete:

```bash
mailcli batch-delete <id1> <id2> <id3>
```
