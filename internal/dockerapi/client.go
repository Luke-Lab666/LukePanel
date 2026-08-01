package dockerapi

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type Client struct {
	http       *http.Client
	socketPath string
}

type Port struct {
	PrivatePort int    `json:"PrivatePort"`
	PublicPort  int    `json:"PublicPort,omitempty"`
	Type        string `json:"Type"`
	IP          string `json:"IP,omitempty"`
}

type Container struct {
	ID      string            `json:"id"`
	Names   []string          `json:"names"`
	Image   string            `json:"image"`
	ImageID string            `json:"image_id"`
	Command string            `json:"command"`
	Created int64             `json:"created"`
	State   string            `json:"state"`
	Status  string            `json:"status"`
	Ports   []Port            `json:"ports"`
	Labels  map[string]string `json:"labels"`
}

type Status struct {
	Available bool   `json:"available"`
	Version   string `json:"version,omitempty"`
	Error     string `json:"error,omitempty"`
}

type Image struct {
	ID          string   `json:"id"`
	RepoTags    []string `json:"repo_tags"`
	RepoDigests []string `json:"repo_digests"`
	Created     int64    `json:"created"`
	Size        int64    `json:"size"`
	Containers  int64    `json:"containers"`
}

type Network struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Driver   string            `json:"driver"`
	Scope    string            `json:"scope"`
	Internal bool              `json:"internal"`
	Labels   map[string]string `json:"labels"`
}

type Volume struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	Scope      string            `json:"scope"`
	Labels     map[string]string `json:"labels"`
}

func New(socketPath string) *Client {
	if socketPath == "" {
		socketPath = "/var/run/docker.sock"
	}
	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{Timeout: 3 * time.Second}).DialContext(ctx, "unix", socketPath)
		},
		DisableCompression: true,
	}
	return &Client{http: &http.Client{Transport: transport, Timeout: 10 * time.Minute}, socketPath: socketPath}
}

func (c *Client) Status(ctx context.Context) Status {
	if _, err := os.Stat(c.socketPath); err != nil {
		return Status{Available: false, Error: "Docker socket 不存在"}
	}
	var v struct {
		Version string `json:"Version"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/version", nil, &v); err != nil {
		return Status{Available: false, Error: err.Error()}
	}
	return Status{Available: true, Version: v.Version}
}

func (c *Client) ListContainers(ctx context.Context) ([]Container, error) {
	var raw []struct {
		ID      string            `json:"Id"`
		Names   []string          `json:"Names"`
		Image   string            `json:"Image"`
		ImageID string            `json:"ImageID"`
		Command string            `json:"Command"`
		Created int64             `json:"Created"`
		State   string            `json:"State"`
		Status  string            `json:"Status"`
		Ports   []Port            `json:"Ports"`
		Labels  map[string]string `json:"Labels"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/containers/json?all=1", nil, &raw); err != nil {
		return nil, err
	}
	out := make([]Container, 0, len(raw))
	for _, r := range raw {
		out = append(out, Container{ID: r.ID, Names: r.Names, Image: r.Image, ImageID: r.ImageID, Command: r.Command, Created: r.Created, State: r.State, Status: r.Status, Ports: r.Ports, Labels: r.Labels})
	}
	return out, nil
}

func (c *Client) Action(ctx context.Context, id, action string) error {
	if !validID(id) {
		return errors.New("invalid container id")
	}
	var endpoint string
	switch action {
	case "start":
		endpoint = "/containers/" + id + "/start"
	case "stop":
		endpoint = "/containers/" + id + "/stop?t=10"
	case "restart":
		endpoint = "/containers/" + id + "/restart?t=10"
	case "kill":
		endpoint = "/containers/" + id + "/kill"
	case "remove":
		endpoint = "/containers/" + id + "?force=0&v=0"
	default:
		return errors.New("unsupported container action")
	}
	method := http.MethodPost
	if action == "remove" {
		method = http.MethodDelete
	}
	resp, err := c.request(ctx, method, endpoint, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return dockerError(resp)
	}
	return nil
}

func (c *Client) Logs(ctx context.Context, id string, tail int) (string, error) {
	if !validID(id) {
		return "", errors.New("invalid container id")
	}
	if tail < 1 || tail > 5000 {
		tail = 300
	}
	q := url.Values{"stdout": {"1"}, "stderr": {"1"}, "timestamps": {"1"}, "tail": {fmt.Sprint(tail)}}
	resp, err := c.request(ctx, http.MethodGet, "/containers/"+id+"/logs?"+q.Encode(), nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return "", dockerError(resp)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return "", err
	}
	return decodeStream(data), nil
}

func (c *Client) ListImages(ctx context.Context) ([]Image, error) {
	var raw []struct {
		ID          string   `json:"Id"`
		RepoTags    []string `json:"RepoTags"`
		RepoDigests []string `json:"RepoDigests"`
		Created     int64    `json:"Created"`
		Size        int64    `json:"Size"`
		Containers  int64    `json:"Containers"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/images/json?all=0", nil, &raw); err != nil {
		return nil, err
	}
	out := make([]Image, 0, len(raw))
	for _, r := range raw {
		out = append(out, Image{ID: r.ID, RepoTags: r.RepoTags, RepoDigests: r.RepoDigests, Created: r.Created, Size: r.Size, Containers: r.Containers})
	}
	return out, nil
}
func (c *Client) PullImage(ctx context.Context, reference string) (string, error) {
	reference = strings.TrimSpace(reference)
	if reference == "" || len(reference) > 300 || strings.ContainsAny(reference, " \t\r\n") {
		return "", errors.New("invalid image reference")
	}
	fromImage, tag := reference, ""
	if !strings.Contains(reference, "@") {
		if colon := strings.LastIndex(reference, ":"); colon > strings.LastIndex(reference, "/") {
			fromImage, tag = reference[:colon], reference[colon+1:]
		}
	}
	query := url.Values{"fromImage": {fromImage}}
	if tag != "" {
		query.Set("tag", tag)
	}
	resp, err := c.request(ctx, http.MethodPost, "/images/create?"+query.Encode(), nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return "", dockerError(resp)
	}
	limited := &io.LimitedReader{R: resp.Body, N: 4 << 20}
	data, err := io.ReadAll(limited)
	if err != nil {
		return "", err
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	for _, line := range strings.Split(string(data), "\n") {
		var event struct {
			Error string `json:"error"`
		}
		if json.Unmarshal([]byte(line), &event) == nil && event.Error != "" {
			return string(data), errors.New(event.Error)
		}
	}
	return string(data), nil
}
func (c *Client) RemoveImage(ctx context.Context, id string) error {
	if !validID(strings.TrimPrefix(id, "sha256:")) {
		return errors.New("invalid image id")
	}
	resp, err := c.request(ctx, http.MethodDelete, "/images/"+url.PathEscape(id)+"?force=0&noprune=0", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return dockerError(resp)
	}
	return nil
}
func (c *Client) ListNetworks(ctx context.Context) ([]Network, error) {
	var raw []struct {
		ID       string            `json:"Id"`
		Name     string            `json:"Name"`
		Driver   string            `json:"Driver"`
		Scope    string            `json:"Scope"`
		Internal bool              `json:"Internal"`
		Labels   map[string]string `json:"Labels"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/networks", nil, &raw); err != nil {
		return nil, err
	}
	out := make([]Network, 0, len(raw))
	for _, r := range raw {
		out = append(out, Network{ID: r.ID, Name: r.Name, Driver: r.Driver, Scope: r.Scope, Internal: r.Internal, Labels: r.Labels})
	}
	return out, nil
}
func (c *Client) RemoveNetwork(ctx context.Context, id string) error {
	if !validID(id) {
		return errors.New("invalid network id")
	}
	resp, err := c.request(ctx, http.MethodDelete, "/networks/"+id, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return dockerError(resp)
	}
	return nil
}
func (c *Client) ListVolumes(ctx context.Context) ([]Volume, error) {
	var raw struct {
		Volumes []struct {
			Name       string            `json:"Name"`
			Driver     string            `json:"Driver"`
			Mountpoint string            `json:"Mountpoint"`
			Scope      string            `json:"Scope"`
			Labels     map[string]string `json:"Labels"`
		} `json:"Volumes"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/volumes", nil, &raw); err != nil {
		return nil, err
	}
	out := make([]Volume, 0, len(raw.Volumes))
	for _, r := range raw.Volumes {
		out = append(out, Volume{Name: r.Name, Driver: r.Driver, Mountpoint: r.Mountpoint, Scope: r.Scope, Labels: r.Labels})
	}
	return out, nil
}
func (c *Client) RemoveVolume(ctx context.Context, name string) error {
	if !validID(name) {
		return errors.New("invalid volume name")
	}
	resp, err := c.request(ctx, http.MethodDelete, "/volumes/"+url.PathEscape(name)+"?force=0", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return dockerError(resp)
	}
	return nil
}

func (c *Client) doJSON(ctx context.Context, method, endpoint string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}
	resp, err := c.request(ctx, method, endpoint, reader)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return dockerError(resp)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *Client) request(ctx context.Context, method, endpoint string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, "http://docker"+endpoint, body)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.http.Do(req)
}

func dockerError(resp *http.Response) error {
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	var payload struct {
		Message string `json:"message"`
	}
	if json.Unmarshal(b, &payload) == nil && payload.Message != "" {
		return errors.New(payload.Message)
	}
	return fmt.Errorf("docker API returned %s", resp.Status)
}

func validID(id string) bool {
	if len(id) < 1 || len(id) > 128 {
		return false
	}
	for _, r := range id {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' || r == '.') {
			return false
		}
	}
	return true
}

func decodeStream(data []byte) string {
	if len(data) < 8 || data[0] > 2 {
		return string(data)
	}
	var out strings.Builder
	r := bufio.NewReader(bytes.NewReader(data))
	for {
		header := make([]byte, 8)
		if _, err := io.ReadFull(r, header); err != nil {
			break
		}
		n := binary.BigEndian.Uint32(header[4:8])
		if n > 16<<20 {
			return string(data)
		}
		payload := make([]byte, n)
		if _, err := io.ReadFull(r, payload); err != nil {
			break
		}
		out.Write(payload)
	}
	return out.String()
}
