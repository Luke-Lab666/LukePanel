package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"time"
)

type HTTPError struct {
	StatusCode int
	Message    string
}

func (e *HTTPError) Error() string {
	if e == nil {
		return "agent request failed"
	}
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf("agent returned HTTP %d", e.StatusCode)
}

type Client struct {
	http   *http.Client
	secret string
}

func NewClient(socketPath, secret string) *Client {
	transport := &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return (&net.Dialer{Timeout: 3 * time.Second}).DialContext(ctx, "unix", socketPath)
	}}
	return &Client{http: &http.Client{Transport: transport, Timeout: 36 * time.Minute}, secret: secret}
}

func (c *Client) JSON(ctx context.Context, method, endpoint string, body, output any) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(data)
	}
	resp, err := c.Raw(ctx, method, endpoint, reader, "application/json")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return decodeError(resp)
	}
	if output == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(output)
}

func (c *Client) Raw(ctx context.Context, method, endpoint string, body io.Reader, contentType string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, "http://agent"+endpoint, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-LukePanel-Agent-Secret", c.secret)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return c.http.Do(req)
}

func Query(endpoint string, values url.Values) string {
	if len(values) == 0 {
		return endpoint
	}
	return endpoint + "?" + values.Encode()
}

func decodeError(resp *http.Response) error {
	var payload struct {
		Error string `json:"error"`
	}
	message := ""
	if json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&payload) == nil {
		message = payload.Error
	}
	if message == "" {
		message = fmt.Sprintf("agent returned %s", resp.Status)
	}
	return &HTTPError{StatusCode: resp.StatusCode, Message: message}
}
