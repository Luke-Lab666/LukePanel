package hostadmin

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

var hostnamePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9.-]{0,62}$`)

type SwapStatus struct {
	Enabled bool   `json:"enabled"`
	Total   uint64 `json:"total"`
	Used    uint64 `json:"used"`
	Path    string `json:"path,omitempty"`
	Managed bool   `json:"managed"`
}

type SysctlStatus struct {
	Preset            string `json:"preset"`
	Label             string `json:"label"`
	Managed           bool   `json:"managed"`
	ConfigPath        string `json:"config_path,omitempty"`
	BBR               bool   `json:"bbr"`
	CongestionControl string `json:"congestion_control,omitempty"`
	DefaultQDisc      string `json:"default_qdisc,omitempty"`
	Swappiness        int    `json:"swappiness"`
}

type HostSettings struct {
	Hostname string       `json:"hostname"`
	Timezone string       `json:"timezone"`
	DNS      []string     `json:"dns"`
	Resolved bool         `json:"systemd_resolved"`
	Swap     SwapStatus   `json:"swap"`
	BBR      bool         `json:"bbr"`
	Sysctl   SysctlStatus `json:"sysctl"`
}

type SwapRequest struct {
	SizeMB int `json:"size_mb"`
}

type DNSRequest struct {
	Servers []string `json:"servers"`
}

type SysctlRequest struct {
	Preset string `json:"preset"`
}

func ReadHostSettings(ctx context.Context) HostSettings {
	hostname, _ := os.Hostname()
	timezone := "UTC"
	if data, err := os.ReadFile("/etc/timezone"); err == nil && strings.TrimSpace(string(data)) != "" {
		timezone = strings.TrimSpace(string(data))
	} else if target, err := filepath.EvalSymlinks("/etc/localtime"); err == nil {
		if index := strings.Index(target, "/zoneinfo/"); index >= 0 {
			timezone = target[index+10:]
		}
	}
	dns := readDNS()
	sysctl := ReadSysctlStatus()
	return HostSettings{Hostname: hostname, Timezone: timezone, DNS: dns, Resolved: serviceActive(ctx, "systemd-resolved.service"), Swap: ReadSwap(), BBR: sysctl.BBR, Sysctl: sysctl}
}

func SetHostname(ctx context.Context, hostname string) error {
	hostname = strings.TrimSpace(hostname)
	if !hostnamePattern.MatchString(hostname) || strings.Contains(hostname, "..") {
		return errors.New("主机名格式不正确")
	}
	if output, err := exec.CommandContext(ctx, "hostnamectl", "set-hostname", hostname).CombinedOutput(); err != nil {
		return fmt.Errorf("修改主机名失败: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func SetTimezone(ctx context.Context, timezone string) error {
	timezone = strings.TrimSpace(timezone)
	if timezone == "" || strings.Contains(timezone, "..") || strings.ContainsAny(timezone, "\x00\r\n\\") {
		return errors.New("时区名称无效")
	}
	if info, err := os.Stat(filepath.Join("/usr/share/zoneinfo", timezone)); err != nil || !info.Mode().IsRegular() {
		return errors.New("系统中不存在这个时区")
	}
	if output, err := exec.CommandContext(ctx, "timedatectl", "set-timezone", timezone).CombinedOutput(); err != nil {
		return fmt.Errorf("修改时区失败: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func SetDNS(ctx context.Context, request DNSRequest) error {
	if !serviceActive(ctx, "systemd-resolved.service") {
		return errors.New("当前系统没有运行 systemd-resolved，暂不自动接管 resolv.conf")
	}
	servers := []string{}
	for _, raw := range request.Servers {
		value := strings.TrimSpace(raw)
		if value == "" {
			continue
		}
		if net.ParseIP(value) == nil {
			return fmt.Errorf("DNS 地址无效: %s", value)
		}
		servers = append(servers, value)
	}
	if len(servers) < 1 || len(servers) > 4 {
		return errors.New("请填写 1-4 个 DNS 地址")
	}
	path := "/etc/systemd/resolved.conf.d/90-lukepanel.conf"
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	old, oldErr := os.ReadFile(path)
	content := "# Managed by LukePanel\n[Resolve]\nDNS=" + strings.Join(servers, " ") + "\nFallbackDNS=1.1.1.1 8.8.8.8\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return err
	}
	rollback := func() {
		if oldErr == nil {
			_ = os.WriteFile(path, old, 0o644)
		} else {
			_ = os.Remove(path)
		}
		_ = exec.CommandContext(ctx, "systemctl", "restart", "systemd-resolved.service").Run()
	}
	if output, err := exec.CommandContext(ctx, "systemctl", "restart", "systemd-resolved.service").CombinedOutput(); err != nil {
		rollback()
		return fmt.Errorf("DNS 服务重启失败，已恢复: %s", strings.TrimSpace(string(output)))
	}
	testCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	if output, err := exec.CommandContext(testCtx, "getent", "ahosts", "github.com").CombinedOutput(); err != nil {
		rollback()
		return fmt.Errorf("新 DNS 无法完成解析，已恢复: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func ReadSwap() SwapStatus {
	file, err := os.Open("/proc/swaps")
	if err != nil {
		return SwapStatus{}
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	first := true
	status := SwapStatus{}
	for scanner.Scan() {
		if first {
			first = false
			continue
		}
		fields := strings.Fields(scanner.Text())
		if len(fields) < 5 {
			continue
		}
		size, _ := strconv.ParseUint(fields[2], 10, 64)
		used, _ := strconv.ParseUint(fields[3], 10, 64)
		status.Enabled = true
		status.Total += size * 1024
		status.Used += used * 1024
		if fields[0] == "/swapfile" {
			status.Path = fields[0]
			status.Managed = true
		} else if status.Path == "" {
			status.Path = fields[0]
		}
	}
	return status
}

func CreateSwap(ctx context.Context, request SwapRequest) (SwapStatus, error) {
	if os.Geteuid() != 0 {
		return SwapStatus{}, errors.New("需要 root 权限创建 Swap")
	}
	if request.SizeMB < 256 || request.SizeMB > 32768 {
		return SwapStatus{}, errors.New("Swap 大小必须是 256MB-32GB")
	}
	status := ReadSwap()
	if status.Enabled {
		return status, errors.New("系统已经启用了 Swap，请先确认现有配置")
	}
	var stat syscall.Statfs_t
	if err := syscall.Statfs("/", &stat); err != nil {
		return SwapStatus{}, err
	}
	available := stat.Bavail * uint64(stat.Bsize)
	required := uint64(request.SizeMB) * 1024 * 1024
	if available < required+512*1024*1024 {
		return SwapStatus{}, errors.New("磁盘剩余空间不足，至少保留额外 512MB")
	}
	path := "/swapfile"
	if _, err := os.Stat(path); err == nil {
		return SwapStatus{}, errors.New("/swapfile 已存在，请先人工确认")
	}
	cleanup := func() {
		_ = exec.CommandContext(ctx, "swapoff", path).Run()
		_ = os.Remove(path)
		_ = removeFstabLine(path)
	}
	if err := exec.CommandContext(ctx, "fallocate", "-l", fmt.Sprintf("%dM", request.SizeMB), path).Run(); err != nil {
		file, createErr := os.OpenFile(path, os.O_CREATE|os.O_WRONLY, 0o600)
		if createErr != nil {
			return SwapStatus{}, createErr
		}
		if truncateErr := file.Truncate(int64(required)); truncateErr != nil {
			file.Close()
			cleanup()
			return SwapStatus{}, truncateErr
		}
		_ = file.Close()
	}
	if err := os.Chmod(path, 0o600); err != nil {
		cleanup()
		return SwapStatus{}, err
	}
	if output, err := exec.CommandContext(ctx, "mkswap", path).CombinedOutput(); err != nil {
		cleanup()
		return SwapStatus{}, fmt.Errorf("mkswap 失败: %s", strings.TrimSpace(string(output)))
	}
	if output, err := exec.CommandContext(ctx, "swapon", path).CombinedOutput(); err != nil {
		cleanup()
		return SwapStatus{}, fmt.Errorf("swapon 失败: %s", strings.TrimSpace(string(output)))
	}
	if err := appendFstabLine(path + " none swap sw 0 0"); err != nil {
		cleanup()
		return SwapStatus{}, err
	}
	return ReadSwap(), nil
}

func DeleteManagedSwap(ctx context.Context) error {
	status := ReadSwap()
	if !status.Managed || status.Path != "/swapfile" {
		return errors.New("没有检测到 LukePanel 可安全删除的 /swapfile")
	}
	if output, err := exec.CommandContext(ctx, "swapoff", "/swapfile").CombinedOutput(); err != nil {
		return fmt.Errorf("关闭 Swap 失败: %s", strings.TrimSpace(string(output)))
	}
	if err := removeFstabLine("/swapfile"); err != nil {
		return err
	}
	return os.Remove("/swapfile")
}

func sysctlPresetLines(preset string) ([]string, bool) {
	switch preset {
	case "balanced":
		return []string{"vm.swappiness = 10", "vm.vfs_cache_pressure = 80", "net.core.somaxconn = 4096", "net.ipv4.tcp_syncookies = 1"}, true
	case "network":
		return []string{"net.core.default_qdisc = fq", "net.ipv4.tcp_congestion_control = bbr", "net.core.somaxconn = 8192", "net.ipv4.tcp_fastopen = 3"}, true
	case "low-memory":
		return []string{"vm.swappiness = 20", "vm.vfs_cache_pressure = 120", "vm.dirty_background_ratio = 3", "vm.dirty_ratio = 10"}, true
	case "reset":
		return nil, true
	default:
		return nil, false
	}
}

func sysctlPresetLabel(preset string) string {
	switch preset {
	case "balanced":
		return "均衡"
	case "network":
		return "网络吞吐"
	case "low-memory":
		return "小内存 VPS"
	case "custom":
		return "自定义配置"
	default:
		return "系统默认"
	}
}

func parseManagedSysctlPreset(data []byte) string {
	text := strings.TrimSpace(string(data))
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "# Managed by LukePanel:") {
			preset := strings.TrimSpace(strings.TrimPrefix(line, "# Managed by LukePanel:"))
			if _, ok := sysctlPresetLines(preset); ok && preset != "reset" {
				return preset
			}
		}
	}
	return "custom"
}

func ReadSysctlStatus() SysctlStatus {
	const path = "/etc/sysctl.d/99-lukepanel.conf"
	status := SysctlStatus{Preset: "default", Label: sysctlPresetLabel("default")}
	if data, err := os.ReadFile(path); err == nil {
		status.Managed = true
		status.ConfigPath = path
		status.Preset = parseManagedSysctlPreset(data)
		status.Label = sysctlPresetLabel(status.Preset)
	}
	status.CongestionControl = readSysctl("net.ipv4.tcp_congestion_control")
	status.DefaultQDisc = readSysctl("net.core.default_qdisc")
	status.BBR = status.CongestionControl == "bbr"
	status.Swappiness, _ = strconv.Atoi(readSysctl("vm.swappiness"))
	return status
}

func ApplySysctlPreset(ctx context.Context, request SysctlRequest) error {
	preset := strings.ToLower(strings.TrimSpace(request.Preset))
	lines, ok := sysctlPresetLines(preset)
	if !ok {
		return errors.New("不支持的 sysctl 预设")
	}
	path := "/etc/sysctl.d/99-lukepanel.conf"
	old, oldErr := os.ReadFile(path)
	if preset == "reset" {
		_ = os.Remove(path)
	} else {
		content := "# Managed by LukePanel: " + preset + "\n" + strings.Join(lines, "\n") + "\n"
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			return err
		}
	}
	output, err := exec.CommandContext(ctx, "sysctl", "--system").CombinedOutput()
	if err != nil {
		if oldErr == nil {
			_ = os.WriteFile(path, old, 0o644)
		} else {
			_ = os.Remove(path)
		}
		_, _ = exec.CommandContext(ctx, "sysctl", "--system").CombinedOutput()
		return fmt.Errorf("sysctl 应用失败，已恢复: %s", tail(string(output), 8000))
	}
	return nil
}

func appendFstabLine(line string) error {
	data, err := os.ReadFile("/etc/fstab")
	if err != nil {
		return err
	}
	if strings.Contains(string(data), "/swapfile") {
		return nil
	}
	content := strings.TrimRight(string(data), "\n") + "\n# Managed by LukePanel\n" + line + "\n"
	return os.WriteFile("/etc/fstab", []byte(content), 0o644)
}
func removeFstabLine(path string) error {
	data, err := os.ReadFile("/etc/fstab")
	if err != nil {
		return err
	}
	lines := []string{}
	skipComment := false
	for _, line := range strings.Split(string(data), "\n") {
		trim := strings.TrimSpace(line)
		if trim == "# Managed by LukePanel" {
			skipComment = true
			continue
		}
		if strings.HasPrefix(trim, path+" ") {
			continue
		}
		if skipComment && trim == "" {
			skipComment = false
			continue
		}
		skipComment = false
		lines = append(lines, line)
	}
	return os.WriteFile("/etc/fstab", []byte(strings.TrimRight(strings.Join(lines, "\n"), "\n")+"\n"), 0o644)
}
func readDNS() []string {
	data, err := os.ReadFile("/etc/resolv.conf")
	if err != nil {
		return nil
	}
	out := []string{}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 2 && fields[0] == "nameserver" {
			out = append(out, fields[1])
		}
	}
	return out
}
func readSysctl(name string) string {
	data, err := os.ReadFile(filepath.Join("/proc/sys", strings.ReplaceAll(name, ".", "/")))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}
func serviceActive(ctx context.Context, name string) bool {
	return exec.CommandContext(ctx, "systemctl", "is-active", "--quiet", name).Run() == nil
}
