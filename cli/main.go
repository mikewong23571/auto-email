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
	defaultBaseURL = "http://localhost:8787/api"
)

type message struct {
	ID         string `json:"id"`
	To         string `json:"to_addr"`
	From       string `json:"from_addr"`
	Subject    string `json:"subject"`
	BodyText   string `json:"body_text"`
	BodyHTML   string `json:"body_html"`
	ReceivedAt int64  `json:"received_at"`
	HasHTML    bool   `json:"has_html"`
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
		usage()
		os.Exit(1)
	}

	cmd := os.Args[1]
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
		listFlags.Parse(os.Args[2:])

		client := newClient(*base, *token)
		requireToken(client.token)

		if err := runList(client, *to, *q, *limit, *offset); err != nil {
			fail(err)
		}
	case "latest":
		latestFlags := flag.NewFlagSet("latest", flag.ExitOnError)
		to := latestFlags.String("to", "", "Recipient email (required)")
		n := latestFlags.Int("n", 5, "Number of messages (1-20)")
		base := latestFlags.String("base", baseEnv, "API base URL")
		token := latestFlags.String("token", tokenEnv, "Bearer token (defaults to API_TOKEN env)")
		latestFlags.Parse(os.Args[2:])

		if *to == "" {
			fail(fmt.Errorf("--to is required"))
		}

		client := newClient(*base, *token)
		requireToken(client.token)

		if err := runLatest(client, *to, *n); err != nil {
			fail(err)
		}
	case "get":
		getFlags := flag.NewFlagSet("get", flag.ExitOnError)
		base := getFlags.String("base", baseEnv, "API base URL")
		token := getFlags.String("token", tokenEnv, "Bearer token (defaults to API_TOKEN env)")
		getFlags.Parse(os.Args[2:])

		if getFlags.NArg() != 1 {
			fail(fmt.Errorf("usage: get <message_id>"))
		}
		id := getFlags.Arg(0)

		client := newClient(*base, *token)
		requireToken(client.token)

		if err := runGet(client, id); err != nil {
			fail(err)
		}
	case "delete":
		delFlags := flag.NewFlagSet("delete", flag.ExitOnError)
		base := delFlags.String("base", baseEnv, "API base URL")
		token := delFlags.String("token", tokenEnv, "Bearer token (defaults to API_TOKEN env)")
		delFlags.Parse(os.Args[2:])

		if delFlags.NArg() != 1 {
			fail(fmt.Errorf("usage: delete <message_id>"))
		}
		id := delFlags.Arg(0)

		client := newClient(*base, *token)
		requireToken(client.token)

		if err := runDelete(client, id); err != nil {
			fail(err)
		}
	case "batch-delete":
		delFlags := flag.NewFlagSet("batch-delete", flag.ExitOnError)
		base := delFlags.String("base", baseEnv, "API base URL")
		token := delFlags.String("token", tokenEnv, "Bearer token (defaults to API_TOKEN env)")
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

		if err := runBatchDelete(client, ids); err != nil {
			fail(err)
		}
	default:
		usage()
		os.Exit(1)
	}
}

func runList(c *apiClient, to, q string, limit, offset int) error {
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

func runLatest(c *apiClient, to string, n int) error {
	params := url.Values{}
	params.Set("to", to)
	params.Set("n", fmt.Sprintf("%d", n))

	var resp latestResponse
	if err := c.request(http.MethodGet, "/messages/latest", params, nil, &resp); err != nil {
		return err
	}

	for _, m := range resp.Data {
		fmt.Printf("- %s | %s | from:%s | subject: %s\n", m.ID, formatTime(m.ReceivedAt), m.From, m.Subject)
	}
	return nil
}

func runGet(c *apiClient, id string) error {
	var resp detailResponse
	if err := c.request(http.MethodGet, "/messages/"+id, nil, nil, &resp); err != nil {
		return err
	}
	m := resp.Data
	fmt.Printf("ID: %s\nTo: %s\nFrom: %s\nReceived: %s\nSubject: %s\nHas HTML: %s\n\nText:\n%s\n",
		m.ID, m.To, m.From, formatTime(m.ReceivedAt), m.Subject, hasHTML(m.HasHTML), m.BodyText)
	if strings.TrimSpace(m.BodyHTML) != "" {
		fmt.Println("\nHTML (sanitized):\n", m.BodyHTML)
	}
	return nil
}

func runDelete(c *apiClient, id string) error {
	if err := c.request(http.MethodDelete, "/messages/"+id, nil, nil, nil); err != nil {
		return err
	}
	fmt.Printf("Deleted message %s\n", id)
	return nil
}

func runBatchDelete(c *apiClient, ids []string) error {
	payload := map[string]any{"ids": ids}
	var resp deleteResponse
	if err := c.request(http.MethodPost, "/messages/batch-delete", nil, payload, &resp); err != nil {
		return err
	}
	fmt.Printf("Deleted %d message(s)\n", resp.Deleted)
	return nil
}

func usage() {
	fmt.Println(`Usage: mailcli <command> [options]

Commands:
  list           List messages (supports --to, --q, --limit, --offset)
  latest         Show latest messages for a recipient (--to required, --n)
  get            Fetch full message by id
  delete         Delete one message by id
  batch-delete   Delete multiple messages by ids

Common flags:
  --base   API base URL (default: http://localhost:8787/api or $API_BASE)
  --token  Bearer token (defaults to $API_TOKEN)`)
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

func hasHTML(v bool) string {
	if v {
		return "html+text"
	}
	return "text"
}

func getenvDefault(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}
