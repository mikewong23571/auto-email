package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	defaultBaseURL = "https://mailbox.styleofwong.com/api"
)

type message struct {
	ID         string `json:"id"`
	To         string `json:"to_addr"`
	From       string `json:"from_addr"`
	Subject    string `json:"subject"`
	BodyText   string `json:"body_text"`
	BodyHTML   string `json:"body_html"`
	ReceivedAt int64  `json:"received_at"`
	HasHTML    int    `json:"has_html"`
	Preview    string `json:"preview"`
}

type listResponse struct {
	Data   []message `json:"data"`
	Total  int       `json:"total"`
	Limit  int       `json:"limit"`
	Offset int       `json:"offset"`
}

type detailResponse struct {
	Data message `json:"data"`
}

type latestResponse struct {
	Data []message `json:"data"`
}

type deleteResponse struct {
	Deleted int `json:"deleted"`
}

type apiClient struct {
	baseURL string
	token   string
	http    *http.Client
}

func newClient(baseURL, token string) *apiClient {
	base := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if base == "" {
		base = defaultBaseURL
	}
	return &apiClient{
		baseURL: base,
		token:   strings.TrimSpace(token),
		http: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *apiClient) request(method, path string, query url.Values, body any, out any) error {
	fullURL := c.baseURL + path
	if len(query) > 0 {
		fullURL += "?" + query.Encode()
	}

	var buf io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode body: %w", err)
		}
		buf = bytes.NewBuffer(b)
	}

	req, err := http.NewRequest(method, fullURL, buf)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode >= 400 {
		data, _ := io.ReadAll(io.LimitReader(res.Body, 2048))
		return fmt.Errorf("api error (%d): %s", res.StatusCode, strings.TrimSpace(string(data)))
	}

	if out == nil || res.StatusCode == http.StatusNoContent {
		return nil
	}

	return json.NewDecoder(res.Body).Decode(out)
}

func main() {
	if len(os.Args) < 2 {
		usageRoot()
		os.Exit(1)
	}

	cmd := os.Args[1]
	if cmd == "-h" || cmd == "--help" || cmd == "help" {
		if len(os.Args) >= 3 {
			usageCommand(os.Args[2])
			return
		}
		usageRoot()
		return
	}
	baseEnv := getenvDefault("API_BASE", defaultBaseURL)
	tokenEnv := os.Getenv("API_TOKEN")

	switch cmd {
	case "list":
		listFlags := flag.NewFlagSet("list", flag.ExitOnError)
		to := listFlags.String("to", "", "Filter by recipient email")
		q := listFlags.String("q", "", "Full-text search query")
		limit := listFlags.Int("limit", 20, "Max results (1-100)")
		offset := listFlags.Int("offset", 0, "Offset for pagination")
		base := listFlags.String("base", baseEnv, "API base URL (e.g. http://localhost:8787/api)")
		token := listFlags.String("token", tokenEnv, "Bearer token (defaults to API_TOKEN env)")
		jsonOut := listFlags.Bool("json", false, "Output raw JSON response")
		listFlags.Parse(os.Args[2:])

		client := newClient(*base, *token)
		requireToken(client.token)

		if err := runList(client, *to, *q, *limit, *offset, *jsonOut); err != nil {
			fail(err)
		}
	case "latest":
		latestFlags := flag.NewFlagSet("latest", flag.ExitOnError)
		to := latestFlags.String("to", "", "Recipient email (required)")
		n := latestFlags.Int("n", 5, "Number of messages (1-20)")
		base := latestFlags.String("base", baseEnv, "API base URL")
		token := latestFlags.String("token", tokenEnv, "Bearer token (defaults to API_TOKEN env)")
		jsonOut := latestFlags.Bool("json", false, "Output raw JSON response")
		latestFlags.Parse(os.Args[2:])

		if *to == "" {
			fail(fmt.Errorf("--to is required"))
		}

		client := newClient(*base, *token)
		requireToken(client.token)

		if err := runLatest(client, *to, *n, *jsonOut); err != nil {
			fail(err)
		}
	case "get":
		getFlags := flag.NewFlagSet("get", flag.ExitOnError)
		base := getFlags.String("base", baseEnv, "API base URL")
		token := getFlags.String("token", tokenEnv, "Bearer token (defaults to API_TOKEN env)")
		jsonOut := getFlags.Bool("json", false, "Output raw JSON response")
		getFlags.Parse(os.Args[2:])

		if getFlags.NArg() != 1 {
			fail(fmt.Errorf("usage: get <message_id>"))
		}
		id := getFlags.Arg(0)

		client := newClient(*base, *token)
		requireToken(client.token)

		if err := runGet(client, id, *jsonOut); err != nil {
			fail(err)
		}
	case "delete":
		delFlags := flag.NewFlagSet("delete", flag.ExitOnError)
		base := delFlags.String("base", baseEnv, "API base URL")
		token := delFlags.String("token", tokenEnv, "Bearer token (defaults to API_TOKEN env)")
		jsonOut := delFlags.Bool("json", false, "Output raw JSON response")
		delFlags.Parse(os.Args[2:])

		if delFlags.NArg() != 1 {
			fail(fmt.Errorf("usage: delete <message_id>"))
		}
		id := delFlags.Arg(0)

		client := newClient(*base, *token)
		requireToken(client.token)

		if err := runDelete(client, id, *jsonOut); err != nil {
			fail(err)
		}
	case "batch-delete":
		delFlags := flag.NewFlagSet("batch-delete", flag.ExitOnError)
		base := delFlags.String("base", baseEnv, "API base URL")
		token := delFlags.String("token", tokenEnv, "Bearer token (defaults to API_TOKEN env)")
		jsonOut := delFlags.Bool("json", false, "Output raw JSON response")
		delFlags.Parse(os.Args[2:])

		if delFlags.NArg() == 0 {
			fail(fmt.Errorf("usage: batch-delete <id1> <id2> ... (max 100)"))
		}
		ids := delFlags.Args()
		if len(ids) > 100 {
			fail(fmt.Errorf("batch-delete supports up to 100 ids"))
		}

		client := newClient(*base, *token)
		requireToken(client.token)

		if err := runBatchDelete(client, ids, *jsonOut); err != nil {
			fail(err)
		}
	default:
		usageRoot()
		os.Exit(1)
	}
}

func runList(c *apiClient, to, q string, limit, offset int, jsonOut bool) error {
	params := url.Values{}
	if to != "" {
		params.Set("to", to)
	}
	if strings.TrimSpace(q) != "" {
		params.Set("q", q)
	}
	params.Set("limit", fmt.Sprintf("%d", limit))
	params.Set("offset", fmt.Sprintf("%d", offset))

	var resp listResponse
	if err := c.request(http.MethodGet, "/messages", params, nil, &resp); err != nil {
		return err
	}

	if jsonOut {
		return printJSON(resp)
	}

	fmt.Printf("Total: %d (limit %d offset %d)\n", resp.Total, resp.Limit, resp.Offset)
	for _, m := range resp.Data {
		fmt.Printf("- %s | to:%s | from:%s | %s | %s\n  subject: %s\n  preview: %s\n",
			m.ID,
			m.To,
			m.From,
			formatTime(m.ReceivedAt),
			hasHTML(m.HasHTML),
			m.Subject,
			trimPreview(m.Preview, 120),
		)
	}
	return nil
}

func runLatest(c *apiClient, to string, n int, jsonOut bool) error {
	params := url.Values{}
	params.Set("to", to)
	params.Set("n", fmt.Sprintf("%d", n))

	var resp latestResponse
	if err := c.request(http.MethodGet, "/messages/latest", params, nil, &resp); err != nil {
		return err
	}

	if jsonOut {
		return printJSON(resp)
	}

	for _, m := range resp.Data {
		fmt.Printf("- %s | %s | from:%s | subject: %s\n", m.ID, formatTime(m.ReceivedAt), m.From, m.Subject)
	}
	return nil
}

func runGet(c *apiClient, id string, jsonOut bool) error {
	var resp detailResponse
	if err := c.request(http.MethodGet, "/messages/"+id, nil, nil, &resp); err != nil {
		return err
	}
	if jsonOut {
		return printJSON(resp)
	}
	m := resp.Data
	fmt.Printf("ID: %s\nTo: %s\nFrom: %s\nReceived: %s\nSubject: %s\nHas HTML: %s\n\nText:\n%s\n",
		m.ID, m.To, m.From, formatTime(m.ReceivedAt), m.Subject, hasHTML(m.HasHTML), m.BodyText)
	if strings.TrimSpace(m.BodyHTML) != "" {
		fmt.Println("\nHTML (sanitized):\n", m.BodyHTML)
	}
	return nil
}

func runDelete(c *apiClient, id string, jsonOut bool) error {
	var resp map[string]any
	if err := c.request(http.MethodDelete, "/messages/"+id, nil, nil, &resp); err != nil {
		return err
	}

	if jsonOut {
		return printJSON(resp)
	}

	fmt.Printf("Deleted message %s\n", id)
	return nil
}

func runBatchDelete(c *apiClient, ids []string, jsonOut bool) error {
	payload := map[string]any{"ids": ids}
	var resp deleteResponse
	if err := c.request(http.MethodPost, "/messages/batch-delete", nil, payload, &resp); err != nil {
		return err
	}
	if jsonOut {
		return printJSON(resp)
	}
	fmt.Printf("Deleted %d message(s)\n", resp.Deleted)
	return nil
}

func usageRoot() {
	fmt.Println(`Mailbox CLI

Usage:
  mailcli <command> [options]
  mailcli help [command]

Commands:
  list           List messages (supports --to, --q, --limit, --offset)
  latest         Show latest messages for a recipient (--to required, --n)
  get            Fetch full message by id
  delete         Delete one message by id
  batch-delete   Delete multiple messages by ids

Auth:
  Token is required. Set $API_TOKEN or pass --token.

Base URL:
  Default base is https://mailbox.styleofwong.com/api
  Override via --base or $API_BASE

Examples:
  mailcli list --to you@example.com
  mailcli list --to you@example.com --q invoice
  mailcli latest --to you@example.com --n 5
  mailcli get <message_id>
  mailcli delete <message_id>
  mailcli batch-delete <id1> <id2> <id3>

Run 'mailcli help <command>' to see command-specific options.`)
}

func usageCommand(command string) {
	switch command {
	case "list":
		fmt.Println(`Usage: mailcli list [options]

List messages.

Options:
  --to EMAIL      Filter by recipient email
  --q QUERY       Full-text search query
  --limit N       Max results (1-100) (default: 20)
  --offset N      Offset for pagination (default: 0)
  --base URL      API base URL (default: $API_BASE or https://mailbox.styleofwong.com/api)
  --token TOKEN   Bearer token (default: $API_TOKEN)
  --json          Output raw JSON response

Examples:
  mailcli list --to you@example.com
  mailcli list --to you@example.com --q invoice --limit 10
  mailcli list --to you@example.com --json`)
	case "latest":
		fmt.Println(`Usage: mailcli latest [options]

Show latest messages for a recipient.

Options:
  --to EMAIL      Recipient email (required)
  --n N           Number of messages (1-20) (default: 5)
  --base URL      API base URL (default: $API_BASE or https://mailbox.styleofwong.com/api)
  --token TOKEN   Bearer token (default: $API_TOKEN)
  --json          Output raw JSON response

Examples:
  mailcli latest --to you@example.com
  mailcli latest --to you@example.com --n 10`)
	case "get":
		fmt.Println(`Usage: mailcli get [options] <message_id>

Fetch full message by id.

Options:
  --base URL      API base URL (default: $API_BASE or https://mailbox.styleofwong.com/api)
  --token TOKEN   Bearer token (default: $API_TOKEN)
  --json          Output raw JSON response

Examples:
  mailcli get 01J...
  mailcli get --json 01J...`)
	case "delete":
		fmt.Println(`Usage: mailcli delete [options] <message_id>

Delete one message by id.

Options:
  --base URL      API base URL (default: $API_BASE or https://mailbox.styleofwong.com/api)
  --token TOKEN   Bearer token (default: $API_TOKEN)
  --json          Output raw JSON response

Example:
  mailcli delete 01J...`)
	case "batch-delete":
		fmt.Println(`Usage: mailcli batch-delete [options] <id1> <id2> ...

Delete multiple messages by ids (max 100).

Options:
  --base URL      API base URL (default: $API_BASE or https://mailbox.styleofwong.com/api)
  --token TOKEN   Bearer token (default: $API_TOKEN)
  --json          Output raw JSON response

Example:
  mailcli batch-delete 01J... 01J... 01J...`)
	default:
		usageRoot()
	}
}

func requireToken(token string) {
	if strings.TrimSpace(token) == "" {
		fail(fmt.Errorf("API token required: pass --token or set API_TOKEN"))
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "Error:", err)
	os.Exit(1)
}

func formatTime(ts int64) string {
	if ts == 0 {
		return "-"
	}
	return time.Unix(ts, 0).Format(time.RFC3339)
}

func trimPreview(s string, max int) string {
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) <= max {
		return s
	}
	return s[:max-3] + "..."
}

func hasHTML(v int) string {
	if v > 0 {
		return "html+text"
	}
	return "text"
}

func printJSON(v any) error {
	buf, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal json: %w", err)
	}
	fmt.Println(string(buf))
	return nil
}

func getenvDefault(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}
