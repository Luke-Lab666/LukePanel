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
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
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
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Scope      string            `json:"scope"`
	Internal   bool              `json:"internal"`
	Containers int               `json:"containers"`
	Labels     map[string]string `json:"labels"`
}

type Volume struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	Scope      string            `json:"scope"`
	Labels     map[string]string `json:"labels"`
}

type ContainerStats struct {
	ID            string  `json:"id"`
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryUsage   uint64  `json:"memory_usage"`
	MemoryLimit   uint64  `json:"memory_limit"`
	MemoryPercent float64 `json:"memory_percent"`
	NetworkRX     uint64  `json:"network_rx"`
	NetworkTX     uint64  `json:"network_tx"`
	BlockRead     uint64  `json:"block_read"`
	BlockWrite    uint64  `json:"block_write"`
}

type CleanupPreview struct {
	StoppedContainers int   `json:"stopped_containers"`
	DanglingImages    int   `json:"dangling_images"`
	UnusedImages      int   `json:"unused_images"`
	UnusedNetworks    int   `json:"unused_networks"`
	UnusedVolumes     int   `json:"unused_volumes"`
	ReclaimableBytes  int64 `json:"reclaimable_bytes"`
}

type CleanupResult struct {
	ContainersDeleted []string `json:"containers_deleted,omitempty"`
	ImagesDeleted     []string `json:"images_deleted,omitempty"`
	NetworksDeleted   []string `json:"networks_deleted,omitempty"`
	VolumesDeleted    []string `json:"volumes_deleted,omitempty"`
	SpaceReclaimed    uint64   `json:"space_reclaimed"`
}

type ComposeContainer struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Service string `json:"service"`
	State   string `json:"state"`
	Status  string `json:"status"`
}

type ComposeProject struct {
	Name        string             `json:"name"`
	WorkingDir  string             `json:"working_dir"`
	ConfigFiles []string           `json:"config_files"`
	Running     int                `json:"running"`
	Total       int                `json:"total"`
	Containers  []ComposeContainer `json:"containers"`
}

var composeProjectPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$`)

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

func (c *Client) ContainerStats(ctx context.Context, ids []string) ([]ContainerStats, error) {
	if len(ids) == 0 {
		containers, err := c.ListContainers(ctx)
		if err != nil {
			return nil, err
		}
		for _, container := range containers {
			if container.State == "running" {
				ids = append(ids, container.ID)
			}
		}
	}
	if len(ids) > 40 {
		ids = ids[:40]
	}
	type result struct {
		stats ContainerStats
		err   error
	}
	jobs := make(chan string)
	results := make(chan result, len(ids))
	workers := min(4, len(ids))
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for id := range jobs {
				stats, err := c.containerStats(ctx, id)
				results <- result{stats: stats, err: err}
			}
		}()
	}
	go func() {
		for _, id := range ids {
			if validID(id) {
				jobs <- id
			}
		}
		close(jobs)
		wg.Wait()
		close(results)
	}()
	out := make([]ContainerStats, 0, len(ids))
	for item := range results {
		if item.err == nil {
			out = append(out, item.stats)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CPUPercent > out[j].CPUPercent })
	return out, nil
}

func (c *Client) containerStats(ctx context.Context, id string) (ContainerStats, error) {
	if !validID(id) {
		return ContainerStats{}, errors.New("invalid container id")
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var raw struct {
		CPUStats struct {
			CPUUsage struct {
				TotalUsage  uint64   `json:"total_usage"`
				PercpuUsage []uint64 `json:"percpu_usage"`
			} `json:"cpu_usage"`
			SystemCPUUsage uint64 `json:"system_cpu_usage"`
			OnlineCPUs     uint64 `json:"online_cpus"`
		} `json:"cpu_stats"`
		PreCPUStats struct {
			CPUUsage struct {
				TotalUsage uint64 `json:"total_usage"`
			} `json:"cpu_usage"`
			SystemCPUUsage uint64 `json:"system_cpu_usage"`
		} `json:"precpu_stats"`
		MemoryStats struct {
			Usage uint64            `json:"usage"`
			Limit uint64            `json:"limit"`
			Stats map[string]uint64 `json:"stats"`
		} `json:"memory_stats"`
		Networks map[string]struct {
			RXBytes uint64 `json:"rx_bytes"`
			TXBytes uint64 `json:"tx_bytes"`
		} `json:"networks"`
		BlockIOStats struct {
			Entries []struct {
				Op    string `json:"op"`
				Value uint64 `json:"value"`
			} `json:"io_service_bytes_recursive"`
		} `json:"blkio_stats"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/containers/"+url.PathEscape(id)+"/stats?stream=false&one-shot=true", nil, &raw); err != nil {
		return ContainerStats{}, err
	}
	stats := ContainerStats{ID: id, MemoryLimit: raw.MemoryStats.Limit}
	var cpuDelta, systemDelta uint64
	if raw.CPUStats.CPUUsage.TotalUsage >= raw.PreCPUStats.CPUUsage.TotalUsage {
		cpuDelta = raw.CPUStats.CPUUsage.TotalUsage - raw.PreCPUStats.CPUUsage.TotalUsage
	}
	if raw.CPUStats.SystemCPUUsage >= raw.PreCPUStats.SystemCPUUsage {
		systemDelta = raw.CPUStats.SystemCPUUsage - raw.PreCPUStats.SystemCPUUsage
	}
	online := raw.CPUStats.OnlineCPUs
	if online == 0 {
		online = uint64(len(raw.CPUStats.CPUUsage.PercpuUsage))
	}
	if cpuDelta > 0 && systemDelta > 0 && online > 0 {
		stats.CPUPercent = float64(cpuDelta) / float64(systemDelta) * float64(online) * 100
	}
	cache := raw.MemoryStats.Stats["inactive_file"]
	if cache == 0 {
		cache = raw.MemoryStats.Stats["cache"]
	}
	stats.MemoryUsage = raw.MemoryStats.Usage
	if stats.MemoryUsage > cache {
		stats.MemoryUsage -= cache
	}
	if stats.MemoryLimit > 0 {
		stats.MemoryPercent = float64(stats.MemoryUsage) / float64(stats.MemoryLimit) * 100
	}
	for _, network := range raw.Networks {
		stats.NetworkRX += network.RXBytes
		stats.NetworkTX += network.TXBytes
	}
	for _, entry := range raw.BlockIOStats.Entries {
		switch strings.ToLower(entry.Op) {
		case "read":
			stats.BlockRead += entry.Value
		case "write":
			stats.BlockWrite += entry.Value
		}
	}
	return stats, nil
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
		ID         string            `json:"Id"`
		Name       string            `json:"Name"`
		Driver     string            `json:"Driver"`
		Scope      string            `json:"Scope"`
		Internal   bool              `json:"Internal"`
		Containers map[string]any    `json:"Containers"`
		Labels     map[string]string `json:"Labels"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/networks", nil, &raw); err != nil {
		return nil, err
	}
	out := make([]Network, 0, len(raw))
	for _, r := range raw {
		out = append(out, Network{ID: r.ID, Name: r.Name, Driver: r.Driver, Scope: r.Scope, Internal: r.Internal, Containers: len(r.Containers), Labels: r.Labels})
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

func (c *Client) CreateNetwork(ctx context.Context, name, driver, subnet, gateway string, internal bool) (Network, error) {
	name = strings.TrimSpace(name)
	driver = strings.TrimSpace(driver)
	subnet = strings.TrimSpace(subnet)
	gateway = strings.TrimSpace(gateway)
	if !validID(name) {
		return Network{}, errors.New("网络名称只能包含字母、数字、点、下划线和短横线")
	}
	if driver == "" {
		driver = "bridge"
	}
	if driver != "bridge" && driver != "macvlan" && driver != "ipvlan" {
		return Network{}, errors.New("当前只支持 bridge、macvlan 或 ipvlan 驱动")
	}
	payload := map[string]any{"Name": name, "Driver": driver, "Internal": internal, "CheckDuplicate": true}
	if subnet != "" || gateway != "" {
		if subnet == "" {
			return Network{}, errors.New("填写网关时必须同时填写子网 CIDR")
		}
		_, network, err := net.ParseCIDR(subnet)
		if err != nil {
			return Network{}, errors.New("子网必须是有效 CIDR，例如 172.30.0.0/16")
		}
		config := map[string]any{"Subnet": subnet}
		if gateway != "" {
			ip := net.ParseIP(gateway)
			if ip == nil || !network.Contains(ip) {
				return Network{}, errors.New("网关必须是子网范围内的有效 IP")
			}
			config["Gateway"] = gateway
		}
		payload["IPAM"] = map[string]any{"Driver": "default", "Config": []any{config}}
	}
	var created struct {
		ID      string `json:"Id"`
		Warning string `json:"Warning"`
	}
	if err := c.doJSON(ctx, http.MethodPost, "/networks/create", payload, &created); err != nil {
		return Network{}, err
	}
	return Network{ID: created.ID, Name: name, Driver: driver, Internal: internal, Scope: "local"}, nil
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

func (c *Client) CreateVolume(ctx context.Context, name, driver string) (Volume, error) {
	name = strings.TrimSpace(name)
	driver = strings.TrimSpace(driver)
	if !validID(name) {
		return Volume{}, errors.New("存储卷名称只能包含字母、数字、点、下划线和短横线")
	}
	if driver == "" {
		driver = "local"
	}
	if !validID(driver) {
		return Volume{}, errors.New("存储卷驱动名称无效")
	}
	var raw struct {
		Name       string            `json:"Name"`
		Driver     string            `json:"Driver"`
		Mountpoint string            `json:"Mountpoint"`
		Scope      string            `json:"Scope"`
		Labels     map[string]string `json:"Labels"`
	}
	if err := c.doJSON(ctx, http.MethodPost, "/volumes/create", map[string]any{"Name": name, "Driver": driver}, &raw); err != nil {
		return Volume{}, err
	}
	return Volume{Name: raw.Name, Driver: raw.Driver, Mountpoint: raw.Mountpoint, Scope: raw.Scope, Labels: raw.Labels}, nil
}

func (c *Client) CleanupPreview(ctx context.Context) (CleanupPreview, error) {
	var raw struct {
		Containers []struct {
			State  string `json:"State"`
			SizeRW int64  `json:"SizeRw"`
		} `json:"Containers"`
		Images []struct {
			Containers int64    `json:"Containers"`
			RepoTags   []string `json:"RepoTags"`
			Size       int64    `json:"Size"`
			SharedSize int64    `json:"SharedSize"`
		} `json:"Images"`
		Volumes []struct {
			UsageData struct {
				RefCount int64 `json:"RefCount"`
				Size     int64 `json:"Size"`
			} `json:"UsageData"`
		} `json:"Volumes"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/system/df", nil, &raw); err != nil {
		return CleanupPreview{}, err
	}
	preview := CleanupPreview{}
	for _, container := range raw.Containers {
		if container.State != "running" {
			preview.StoppedContainers++
			if container.SizeRW > 0 {
				preview.ReclaimableBytes += container.SizeRW
			}
		}
	}
	for _, image := range raw.Images {
		if image.Containers <= 0 {
			preview.UnusedImages++
			if len(image.RepoTags) == 0 || (len(image.RepoTags) == 1 && image.RepoTags[0] == "<none>:<none>") {
				preview.DanglingImages++
			}
			reclaimable := image.Size - image.SharedSize
			if reclaimable > 0 {
				preview.ReclaimableBytes += reclaimable
			}
		}
	}
	for _, volume := range raw.Volumes {
		if volume.UsageData.RefCount <= 0 {
			preview.UnusedVolumes++
			if volume.UsageData.Size > 0 {
				preview.ReclaimableBytes += volume.UsageData.Size
			}
		}
	}
	networks, err := c.ListNetworks(ctx)
	if err == nil {
		for _, network := range networks {
			if !map[string]bool{"bridge": true, "host": true, "none": true}[network.Name] && network.Containers == 0 {
				preview.UnusedNetworks++
			}
		}
	}
	return preview, nil
}

func (c *Client) Cleanup(ctx context.Context, mode string, includeVolumes bool) (CleanupResult, error) {
	if mode != "safe" && mode != "deep" {
		return CleanupResult{}, errors.New("清理模式无效")
	}
	result := CleanupResult{}
	if err := c.prune(ctx, "/containers/prune", nil, &result.ContainersDeleted, &result.SpaceReclaimed); err != nil {
		return result, fmt.Errorf("清理停止容器失败: %w", err)
	}
	filters := map[string]any{}
	if mode == "safe" {
		filters["dangling"] = []string{"true"}
	}
	query := url.Values{}
	if len(filters) > 0 {
		data, _ := json.Marshal(filters)
		query.Set("filters", string(data))
	}
	endpoint := "/images/prune"
	if encoded := query.Encode(); encoded != "" {
		endpoint += "?" + encoded
	}
	if err := c.prune(ctx, endpoint, nil, &result.ImagesDeleted, &result.SpaceReclaimed); err != nil {
		return result, fmt.Errorf("清理镜像失败: %w", err)
	}
	if err := c.prune(ctx, "/networks/prune", nil, &result.NetworksDeleted, &result.SpaceReclaimed); err != nil {
		return result, fmt.Errorf("清理网络失败: %w", err)
	}
	if includeVolumes {
		if err := c.prune(ctx, "/volumes/prune", nil, &result.VolumesDeleted, &result.SpaceReclaimed); err != nil {
			return result, fmt.Errorf("清理存储卷失败: %w", err)
		}
	}
	return result, nil
}

func (c *Client) prune(ctx context.Context, endpoint string, body any, deleted *[]string, reclaimed *uint64) error {
	var raw struct {
		ContainersDeleted []string `json:"ContainersDeleted"`
		ImagesDeleted     []struct {
			Deleted  string `json:"Deleted"`
			Untagged string `json:"Untagged"`
		} `json:"ImagesDeleted"`
		NetworksDeleted []string `json:"NetworksDeleted"`
		VolumesDeleted  []string `json:"VolumesDeleted"`
		SpaceReclaimed  uint64   `json:"SpaceReclaimed"`
	}
	if err := c.doJSON(ctx, http.MethodPost, endpoint, body, &raw); err != nil {
		return err
	}
	*deleted = append(*deleted, raw.ContainersDeleted...)
	*deleted = append(*deleted, raw.NetworksDeleted...)
	*deleted = append(*deleted, raw.VolumesDeleted...)
	for _, image := range raw.ImagesDeleted {
		if image.Deleted != "" {
			*deleted = append(*deleted, image.Deleted)
		} else if image.Untagged != "" {
			*deleted = append(*deleted, image.Untagged)
		}
	}
	*reclaimed += raw.SpaceReclaimed
	return nil
}
func (c *Client) ComposeProjects(ctx context.Context) ([]ComposeProject, error) {
	containers, err := c.ListContainers(ctx)
	if err != nil {
		return nil, err
	}
	projects := map[string]*ComposeProject{}
	for _, container := range containers {
		name := strings.TrimSpace(container.Labels["com.docker.compose.project"])
		if name == "" || !composeProjectPattern.MatchString(name) {
			continue
		}
		project := projects[name]
		if project == nil {
			workingDir := filepath.Clean(container.Labels["com.docker.compose.project.working_dir"])
			files := splitComposeFiles(container.Labels["com.docker.compose.project.config_files"])
			project = &ComposeProject{Name: name, WorkingDir: workingDir, ConfigFiles: files}
			projects[name] = project
		}
		containerName := container.ID[:minInt(len(container.ID), 12)]
		if len(container.Names) > 0 {
			containerName = strings.TrimPrefix(container.Names[0], "/")
		}
		project.Containers = append(project.Containers, ComposeContainer{ID: container.ID, Name: containerName, Service: container.Labels["com.docker.compose.service"], State: container.State, Status: container.Status})
		project.Total++
		if container.State == "running" {
			project.Running++
		}
	}
	out := make([]ComposeProject, 0, len(projects))
	for _, project := range projects {
		sort.Slice(project.Containers, func(i, j int) bool { return project.Containers[i].Service < project.Containers[j].Service })
		out = append(out, *project)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func (c *Client) ComposeAction(ctx context.Context, projectName, action string) (string, error) {
	if !composeProjectPattern.MatchString(projectName) {
		return "", errors.New("invalid compose project")
	}
	allowed := map[string]bool{"up": true, "stop": true, "restart": true, "down": true, "pull": true}
	if !allowed[action] {
		return "", errors.New("unsupported compose action")
	}
	projects, err := c.ComposeProjects(ctx)
	if err != nil {
		return "", err
	}
	var project *ComposeProject
	for i := range projects {
		if projects[i].Name == projectName {
			project = &projects[i]
			break
		}
	}
	if project == nil {
		return "", errors.New("Compose 项目不存在")
	}
	if !filepath.IsAbs(project.WorkingDir) {
		return "", errors.New("Compose 工作目录无效")
	}
	if _, err := os.Stat(project.WorkingDir); err != nil {
		return "", fmt.Errorf("Compose 工作目录不可用: %w", err)
	}
	if _, err := exec.LookPath("docker"); err != nil {
		return "", errors.New("未找到 docker 命令")
	}
	args := []string{"compose", "--project-directory", project.WorkingDir, "-p", project.Name}
	for _, file := range project.ConfigFiles {
		if !filepath.IsAbs(file) || strings.ContainsAny(file, "\x00\r\n") {
			return "", errors.New("Compose 配置路径无效")
		}
		if _, err := os.Stat(file); err != nil {
			return "", fmt.Errorf("Compose 配置不存在: %s", file)
		}
		args = append(args, "-f", file)
	}
	if len(project.ConfigFiles) == 0 {
		return "", errors.New("没有读取到 Compose 配置文件")
	}
	switch action {
	case "up":
		args = append(args, "up", "-d")
	case "pull":
		args = append(args, "pull")
	default:
		args = append(args, action)
	}
	commandCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(commandCtx, "docker", args...)
	cmd.Dir = project.WorkingDir
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return stdout.String(), errors.New(message)
	}
	return strings.TrimSpace(stdout.String() + "\n" + stderr.String()), nil
}

func splitComposeFiles(value string) []string {
	parts := strings.FieldsFunc(value, func(r rune) bool { return r == ',' || r == ';' })
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = filepath.Clean(strings.TrimSpace(part))
		if part != "." && part != "" {
			out = append(out, part)
		}
	}
	return out
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
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

type EditPort struct {
	HostIP        string `json:"host_ip"`
	HostPort      string `json:"host_port"`
	ContainerPort string `json:"container_port"`
	Protocol      string `json:"protocol"`
}

type EditMount struct {
	Type     string `json:"type"`
	Source   string `json:"source"`
	Target   string `json:"target"`
	ReadOnly bool   `json:"read_only"`
}

type ContainerEditSpec struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	Image          string            `json:"image"`
	Env            []string          `json:"env"`
	Cmd            []string          `json:"cmd"`
	Entrypoint     []string          `json:"entrypoint"`
	WorkingDir     string            `json:"working_dir"`
	User           string            `json:"user"`
	Hostname       string            `json:"hostname"`
	RestartPolicy  string            `json:"restart_policy"`
	RestartMaximum int               `json:"restart_maximum_retry_count"`
	NetworkMode    string            `json:"network_mode"`
	Privileged     bool              `json:"privileged"`
	AutoRemove     bool              `json:"auto_remove"`
	Running        bool              `json:"running"`
	ComposeManaged bool              `json:"compose_managed"`
	ComposeProject string            `json:"compose_project,omitempty"`
	ComposeService string            `json:"compose_service,omitempty"`
	ComposeFiles   []string          `json:"compose_files,omitempty"`
	Ports          []EditPort        `json:"ports"`
	Mounts         []EditMount       `json:"mounts"`
	Labels         map[string]string `json:"labels"`
}

type RecreateRequest struct {
	ID             string      `json:"id"`
	Name           string      `json:"name"`
	Image          string      `json:"image"`
	Env            []string    `json:"env"`
	Cmd            []string    `json:"cmd"`
	Entrypoint     []string    `json:"entrypoint"`
	WorkingDir     string      `json:"working_dir"`
	User           string      `json:"user"`
	Hostname       string      `json:"hostname"`
	RestartPolicy  string      `json:"restart_policy"`
	RestartMaximum int         `json:"restart_maximum_retry_count"`
	Ports          []EditPort  `json:"ports"`
	Mounts         []EditMount `json:"mounts"`
	Start          bool        `json:"start"`
}

type RecreateResult struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Warning string `json:"warning,omitempty"`
}

type rawContainerInspect struct {
	ID    string `json:"Id"`
	Name  string `json:"Name"`
	State struct {
		Running bool `json:"Running"`
	} `json:"State"`
	Config          map[string]any `json:"Config"`
	HostConfig      map[string]any `json:"HostConfig"`
	Mounts          []rawMount     `json:"Mounts"`
	NetworkSettings struct {
		Networks map[string]map[string]any `json:"Networks"`
	} `json:"NetworkSettings"`
}

type rawMount struct {
	Type        string `json:"Type"`
	Name        string `json:"Name"`
	Source      string `json:"Source"`
	Destination string `json:"Destination"`
	Mode        string `json:"Mode"`
	RW          bool   `json:"RW"`
}

func (c *Client) InspectContainer(ctx context.Context, id string) (ContainerEditSpec, error) {
	inspect, err := c.inspectContainer(ctx, id)
	if err != nil {
		return ContainerEditSpec{}, err
	}
	return editSpecFromInspect(inspect), nil
}

func (c *Client) inspectContainer(ctx context.Context, id string) (rawContainerInspect, error) {
	if !validID(id) {
		return rawContainerInspect{}, errors.New("invalid container id")
	}
	var inspect rawContainerInspect
	if err := c.doJSON(ctx, http.MethodGet, "/containers/"+url.PathEscape(id)+"/json", nil, &inspect); err != nil {
		return rawContainerInspect{}, err
	}
	return inspect, nil
}

func editSpecFromInspect(inspect rawContainerInspect) ContainerEditSpec {
	labels := stringMap(inspect.Config["Labels"])
	restartName, restartMaximum := "no", 0
	if restart, ok := inspect.HostConfig["RestartPolicy"].(map[string]any); ok {
		restartName = stringValue(restart["Name"])
		restartMaximum = intValue(restart["MaximumRetryCount"])
	}
	ports := make([]EditPort, 0)
	if bindings, ok := inspect.HostConfig["PortBindings"].(map[string]any); ok {
		keys := make([]string, 0, len(bindings))
		for key := range bindings {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			parts := strings.SplitN(key, "/", 2)
			protocol := "tcp"
			if len(parts) == 2 {
				protocol = parts[1]
			}
			values, _ := bindings[key].([]any)
			if len(values) == 0 {
				ports = append(ports, EditPort{ContainerPort: parts[0], Protocol: protocol})
				continue
			}
			for _, value := range values {
				binding, _ := value.(map[string]any)
				ports = append(ports, EditPort{HostIP: stringValue(binding["HostIp"]), HostPort: stringValue(binding["HostPort"]), ContainerPort: parts[0], Protocol: protocol})
			}
		}
	}
	mounts := make([]EditMount, 0, len(inspect.Mounts))
	for _, mount := range inspect.Mounts {
		if mount.Type != "bind" && mount.Type != "volume" {
			continue
		}
		source := mount.Source
		if mount.Type == "volume" && mount.Name != "" {
			source = mount.Name
		}
		mounts = append(mounts, EditMount{Type: mount.Type, Source: source, Target: mount.Destination, ReadOnly: !mount.RW})
	}
	composeProject := labels["com.docker.compose.project"]
	return ContainerEditSpec{
		ID: inspect.ID, Name: strings.TrimPrefix(inspect.Name, "/"), Image: stringValue(inspect.Config["Image"]),
		Env: stringSlice(inspect.Config["Env"]), Cmd: stringSlice(inspect.Config["Cmd"]), Entrypoint: stringSlice(inspect.Config["Entrypoint"]),
		WorkingDir: stringValue(inspect.Config["WorkingDir"]), User: stringValue(inspect.Config["User"]), Hostname: stringValue(inspect.Config["Hostname"]),
		RestartPolicy: restartName, RestartMaximum: restartMaximum, NetworkMode: stringValue(inspect.HostConfig["NetworkMode"]),
		Privileged: boolValue(inspect.HostConfig["Privileged"]), AutoRemove: boolValue(inspect.HostConfig["AutoRemove"]), Running: inspect.State.Running,
		ComposeManaged: composeProject != "", ComposeProject: composeProject, ComposeService: labels["com.docker.compose.service"],
		ComposeFiles: splitComposeFiles(labels["com.docker.compose.project.config_files"]), Ports: ports, Mounts: mounts, Labels: labels,
	}
}

func (c *Client) RecreateContainer(ctx context.Context, request RecreateRequest) (RecreateResult, error) {
	inspect, err := c.inspectContainer(ctx, request.ID)
	if err != nil {
		return RecreateResult{}, err
	}
	spec := editSpecFromInspect(inspect)
	if spec.ComposeManaged {
		return RecreateResult{}, errors.New("这个容器由 Docker Compose 管理，请编辑 Compose YAML 后执行启动/更新")
	}
	if spec.AutoRemove {
		return RecreateResult{}, errors.New("自动删除容器暂不支持安全重建")
	}
	if err := validateRecreateRequest(&request); err != nil {
		return RecreateResult{}, err
	}
	configMap := cloneMap(inspect.Config)
	configMap["Image"] = request.Image
	configMap["Env"] = request.Env
	configMap["Cmd"] = nullableSlice(request.Cmd)
	configMap["Entrypoint"] = nullableSlice(request.Entrypoint)
	configMap["WorkingDir"] = request.WorkingDir
	configMap["User"] = request.User
	configMap["Hostname"] = request.Hostname

	exposed := map[string]any{}
	bindings := map[string]any{}
	for _, port := range request.Ports {
		key := port.ContainerPort + "/" + port.Protocol
		exposed[key] = map[string]any{}
		bindings[key] = append(anySlice(bindings[key]), map[string]string{"HostIp": port.HostIP, "HostPort": port.HostPort})
	}
	configMap["ExposedPorts"] = exposed
	hostConfig := cloneMap(inspect.HostConfig)
	hostConfig["PortBindings"] = bindings
	hostConfig["RestartPolicy"] = map[string]any{"Name": request.RestartPolicy, "MaximumRetryCount": request.RestartMaximum}
	mounts := make([]map[string]any, 0, len(request.Mounts))
	for _, mount := range request.Mounts {
		mounts = append(mounts, map[string]any{"Type": mount.Type, "Source": mount.Source, "Target": mount.Target, "ReadOnly": mount.ReadOnly})
	}
	hostConfig["Mounts"] = mounts
	delete(hostConfig, "Binds")

	payload := cloneMap(configMap)
	payload["HostConfig"] = hostConfig
	if networking := safeNetworkingConfig(inspect, spec.Name); networking != nil {
		payload["NetworkingConfig"] = networking
	}

	originalName := spec.Name
	backupName := fmt.Sprintf("%s.lukepanel-backup-%d", trimName(originalName, 82), time.Now().Unix())
	if err := c.noContent(ctx, http.MethodPost, "/containers/"+url.PathEscape(inspect.ID)+"/rename?name="+url.QueryEscape(backupName), nil); err != nil {
		return RecreateResult{}, fmt.Errorf("准备旧容器失败: %w", err)
	}
	oldRenamed := true
	rollback := func(newID string) {
		if newID != "" {
			_ = c.noContent(context.Background(), http.MethodDelete, "/containers/"+url.PathEscape(newID)+"?force=1&v=0", nil)
		}
		if oldRenamed {
			_ = c.noContent(context.Background(), http.MethodPost, "/containers/"+url.PathEscape(inspect.ID)+"/rename?name="+url.QueryEscape(originalName), nil)
			if inspect.State.Running {
				_ = c.noContent(context.Background(), http.MethodPost, "/containers/"+url.PathEscape(inspect.ID)+"/start", nil)
			}
		}
	}
	if inspect.State.Running {
		if err := c.noContent(ctx, http.MethodPost, "/containers/"+url.PathEscape(inspect.ID)+"/stop?t=15", nil); err != nil {
			rollback("")
			return RecreateResult{}, fmt.Errorf("停止旧容器失败: %w", err)
		}
	}
	var created struct {
		ID       string   `json:"Id"`
		Warnings []string `json:"Warnings"`
	}
	if err := c.doJSON(ctx, http.MethodPost, "/containers/create?name="+url.QueryEscape(request.Name), payload, &created); err != nil {
		rollback("")
		return RecreateResult{}, fmt.Errorf("创建新容器失败，旧容器已恢复: %w", err)
	}
	if request.Start {
		if err := c.noContent(ctx, http.MethodPost, "/containers/"+url.PathEscape(created.ID)+"/start", nil); err != nil {
			rollback(created.ID)
			return RecreateResult{}, fmt.Errorf("新容器启动失败，旧容器已恢复: %w", err)
		}
	}
	warning := strings.Join(created.Warnings, "；")
	if err := c.noContent(ctx, http.MethodDelete, "/containers/"+url.PathEscape(inspect.ID)+"?force=0&v=0", nil); err != nil {
		oldRenamed = false
		if warning != "" {
			warning += "；"
		}
		warning += "新容器已创建，但旧备份容器未自动删除：" + backupName
	} else {
		oldRenamed = false
	}
	return RecreateResult{ID: created.ID, Name: request.Name, Warning: warning}, nil
}

func validateRecreateRequest(request *RecreateRequest) error {
	request.Name = strings.TrimSpace(strings.TrimPrefix(request.Name, "/"))
	request.Image = strings.TrimSpace(request.Image)
	request.WorkingDir = strings.TrimSpace(request.WorkingDir)
	request.User = strings.TrimSpace(request.User)
	request.Hostname = strings.TrimSpace(request.Hostname)
	if !validID(request.ID) || !validID(request.Name) {
		return errors.New("容器名称只能包含字母、数字、点、下划线和短横线")
	}
	if request.Image == "" || len(request.Image) > 300 || strings.ContainsAny(request.Image, "\x00\r\n\t ") {
		return errors.New("镜像名称无效")
	}
	allowedRestart := map[string]bool{"no": true, "always": true, "unless-stopped": true, "on-failure": true}
	if !allowedRestart[request.RestartPolicy] {
		return errors.New("重启策略无效")
	}
	if request.RestartPolicy != "on-failure" {
		request.RestartMaximum = 0
	}
	if request.RestartMaximum < 0 || request.RestartMaximum > 100000 {
		return errors.New("最大重试次数无效")
	}
	if len(request.Env) > 1000 || len(request.Ports) > 256 || len(request.Mounts) > 256 || len(request.Cmd) > 256 || len(request.Entrypoint) > 64 {
		return errors.New("容器配置项目过多")
	}
	for i, value := range request.Env {
		value = strings.TrimSpace(value)
		if value == "" {
			request.Env[i] = ""
			continue
		}
		key, _, ok := strings.Cut(value, "=")
		if !ok || key == "" || strings.ContainsAny(key, " \t\r\n\x00") {
			return fmt.Errorf("环境变量格式错误: %s", value)
		}
		request.Env[i] = value
	}
	request.Env = compactStrings(request.Env)
	seenPorts := map[string]bool{}
	for i := range request.Ports {
		port := &request.Ports[i]
		port.HostIP = strings.TrimSpace(port.HostIP)
		port.HostPort = strings.TrimSpace(port.HostPort)
		port.ContainerPort = strings.TrimSpace(port.ContainerPort)
		port.Protocol = strings.ToLower(strings.TrimSpace(port.Protocol))
		if port.Protocol == "" {
			port.Protocol = "tcp"
		}
		if port.Protocol != "tcp" && port.Protocol != "udp" && port.Protocol != "sctp" {
			return errors.New("端口协议只支持 tcp、udp 或 sctp")
		}
		containerPort, err := strconv.Atoi(port.ContainerPort)
		if err != nil || containerPort < 1 || containerPort > 65535 {
			return errors.New("容器端口必须是 1-65535")
		}
		if port.HostPort != "" {
			hostPort, err := strconv.Atoi(port.HostPort)
			if err != nil || hostPort < 1 || hostPort > 65535 {
				return errors.New("宿主机端口必须是 1-65535")
			}
		}
		if port.HostIP != "" && net.ParseIP(port.HostIP) == nil {
			return errors.New("宿主机监听 IP 无效")
		}
		key := port.HostIP + ":" + port.HostPort + ":" + port.ContainerPort + "/" + port.Protocol
		if seenPorts[key] {
			return errors.New("存在重复端口映射")
		}
		seenPorts[key] = true
	}
	seenTargets := map[string]bool{}
	for i := range request.Mounts {
		mount := &request.Mounts[i]
		mount.Type = strings.ToLower(strings.TrimSpace(mount.Type))
		mount.Source = filepath.Clean(strings.TrimSpace(mount.Source))
		mount.Target = filepath.Clean(strings.TrimSpace(mount.Target))
		if mount.Type != "bind" && mount.Type != "volume" {
			return errors.New("挂载类型只支持 bind 或 volume")
		}
		if !filepath.IsAbs(mount.Target) || mount.Target == "/" || strings.ContainsAny(mount.Target, "\x00\r\n") {
			return errors.New("容器挂载目标必须是绝对路径")
		}
		if mount.Type == "bind" {
			if !filepath.IsAbs(mount.Source) || strings.ContainsAny(mount.Source, "\x00\r\n") {
				return errors.New("绑定挂载源必须是宿主机绝对路径")
			}
		} else if !validID(mount.Source) {
			return errors.New("存储卷名称无效")
		}
		if seenTargets[mount.Target] {
			return errors.New("同一个容器目录不能重复挂载")
		}
		seenTargets[mount.Target] = true
	}
	return nil
}

func (c *Client) noContent(ctx context.Context, method, endpoint string, body any) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(data)
	}
	resp, err := c.request(ctx, method, endpoint, reader)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return dockerError(resp)
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	return nil
}

func safeNetworkingConfig(inspect rawContainerInspect, oldName string) map[string]any {
	if len(inspect.NetworkSettings.Networks) == 0 {
		return nil
	}
	endpoints := map[string]any{}
	for name, raw := range inspect.NetworkSettings.Networks {
		endpoint := map[string]any{}
		for _, key := range []string{"IPAMConfig", "Links", "DriverOpts", "GwPriority"} {
			if value, exists := raw[key]; exists && value != nil {
				endpoint[key] = value
			}
		}
		aliases := stringSlice(raw["Aliases"])
		filtered := make([]string, 0, len(aliases))
		for _, alias := range aliases {
			if alias != "" && alias != oldName && alias != inspect.ID && !strings.HasPrefix(inspect.ID, alias) {
				filtered = append(filtered, alias)
			}
		}
		if len(filtered) > 0 {
			endpoint["Aliases"] = filtered
		}
		endpoints[name] = endpoint
	}
	return map[string]any{"EndpointsConfig": endpoints}
}

func cloneMap(input map[string]any) map[string]any {
	out := make(map[string]any, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
}

func stringValue(value any) string {
	text, _ := value.(string)
	return text
}

func boolValue(value any) bool {
	result, _ := value.(bool)
	return result
}

func intValue(value any) int {
	switch number := value.(type) {
	case float64:
		return int(number)
	case int:
		return number
	case json.Number:
		v, _ := number.Int64()
		return int(v)
	default:
		return 0
	}
}

func stringSlice(value any) []string {
	switch list := value.(type) {
	case []string:
		return append([]string(nil), list...)
	case []any:
		out := make([]string, 0, len(list))
		for _, item := range list {
			if text, ok := item.(string); ok {
				out = append(out, text)
			}
		}
		return out
	default:
		return nil
	}
}

func stringMap(value any) map[string]string {
	out := map[string]string{}
	switch labels := value.(type) {
	case map[string]string:
		for key, val := range labels {
			out[key] = val
		}
	case map[string]any:
		for key, val := range labels {
			if text, ok := val.(string); ok {
				out[key] = text
			}
		}
	}
	return out
}

func anySlice(value any) []any {
	if value == nil {
		return nil
	}
	if list, ok := value.([]any); ok {
		return list
	}
	return nil
}

func nullableSlice(values []string) any {
	if len(values) == 0 {
		return nil
	}
	return values
}

func compactStrings(values []string) []string {
	out := values[:0]
	for _, value := range values {
		if value != "" {
			out = append(out, value)
		}
	}
	return out
}

func trimName(value string, max int) string {
	if len(value) <= max {
		return value
	}
	return value[:max]
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
