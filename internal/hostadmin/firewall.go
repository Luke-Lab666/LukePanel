package hostadmin

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

type FirewallRule struct {
	Number  int    `json:"number"`
	To      string `json:"to"`
	Action  string `json:"action"`
	From    string `json:"from"`
	Version string `json:"version,omitempty"`
}

type FirewallStatus struct {
	Installed       bool           `json:"installed"`
	Enabled         bool           `json:"enabled"`
	DefaultIncoming string         `json:"default_incoming,omitempty"`
	DefaultOutgoing string         `json:"default_outgoing,omitempty"`
	Rules           []FirewallRule `json:"rules"`
	RecoveryPending bool           `json:"recovery_pending"`
	Error           string         `json:"error,omitempty"`
}

type FirewallRuleRequest struct {
	Action    string `json:"action"`
	Direction string `json:"direction"`
	Protocol  string `json:"protocol"`
	Port      string `json:"port"`
	Source    string `json:"source"`
	Comment   string `json:"comment"`
}

var firewallPortPattern = regexp.MustCompile(`^[0-9]{1,5}(?::[0-9]{1,5})?$`)

func FirewallInfo(ctx context.Context) FirewallStatus {
	if _, err := exec.LookPath("ufw"); err != nil {
		return FirewallStatus{Installed: false}
	}
	status := FirewallStatus{Installed: true}
	output, err := commandOutput(ctx, "ufw", "status", "numbered")
	if err != nil {
		status.Error = strings.TrimSpace(output)
		return status
	}
	lower := strings.ToLower(output)
	status.Enabled = strings.Contains(lower, "status: active")
	status.Rules = parseUFWRules(output)
	verbose, _ := commandOutput(ctx, "ufw", "status", "verbose")
	for _, line := range strings.Split(verbose, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(strings.ToLower(line), "default:") {
			parts := strings.Split(strings.TrimSpace(strings.TrimPrefix(line, "Default:")), ",")
			for _, part := range parts {
				value := strings.TrimSpace(part)
				if strings.Contains(value, "incoming") {
					status.DefaultIncoming = strings.Fields(value)[0]
				}
				if strings.Contains(value, "outgoing") {
					status.DefaultOutgoing = strings.Fields(value)[0]
				}
			}
		}
	}
	_, err = os.Stat("/run/lukepanel/ufw-recovery.pending")
	status.RecoveryPending = err == nil
	return status
}

func InstallUFW(ctx context.Context) (InstallResult, error) {
	if os.Geteuid() != 0 {
		return InstallResult{}, errors.New("需要 root 权限安装 UFW")
	}
	if _, err := exec.LookPath("ufw"); err == nil {
		return InstallResult{Installed: true, Output: "UFW 已安装"}, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 8*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, "apt-get", "install", "-y", "ufw")
	cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return InstallResult{Output: tail(string(out), 24000)}, fmt.Errorf("安装 UFW 失败: %w", err)
	}
	return InstallResult{Installed: true, Output: tail(string(out), 24000)}, nil
}

func EnableUFW(ctx context.Context, currentIP string, sshPorts []int) (FirewallStatus, error) {
	if os.Geteuid() != 0 {
		return FirewallStatus{}, errors.New("需要 root 权限启用 UFW")
	}
	if _, err := exec.LookPath("ufw"); err != nil {
		return FirewallStatus{}, errors.New("请先安装 UFW")
	}
	if len(sshPorts) == 0 {
		sshPorts = []int{22}
	}
	seen := map[int]bool{}
	for _, port := range sshPorts {
		if port < 1 || port > 65535 || seen[port] {
			continue
		}
		seen[port] = true
		args := []string{"allow", strconv.Itoa(port) + "/tcp"}
		if ip := net.ParseIP(strings.TrimSpace(currentIP)); ip != nil && !ip.IsLoopback() {
			args = []string{"allow", "from", ip.String(), "to", "any", "port", strconv.Itoa(port), "proto", "tcp"}
		}
		if out, err := commandOutput(ctx, "ufw", args...); err != nil {
			return FirewallStatus{}, fmt.Errorf("放行 SSH 端口失败: %s", strings.TrimSpace(out))
		}
	}
	_, _ = commandOutput(ctx, "ufw", "default", "deny", "incoming")
	_, _ = commandOutput(ctx, "ufw", "default", "allow", "outgoing")
	if out, err := commandOutput(ctx, "ufw", "--force", "enable"); err != nil {
		return FirewallStatus{}, fmt.Errorf("启用 UFW 失败: %s", strings.TrimSpace(out))
	}
	if err := scheduleUFWRecovery(ctx); err != nil {
		_, _ = commandOutput(context.Background(), "ufw", "--force", "disable")
		return FirewallStatus{}, fmt.Errorf("无法创建防失联恢复任务，已关闭 UFW: %w", err)
	}
	return FirewallInfo(ctx), nil
}

func ConfirmUFW(ctx context.Context) error {
	if _, err := exec.LookPath("systemctl"); err == nil {
		_, _ = commandOutput(ctx, "systemctl", "stop", "lukepanel-ufw-recovery.timer")
		_, _ = commandOutput(ctx, "systemctl", "stop", "lukepanel-ufw-recovery.service")
		_, _ = commandOutput(ctx, "systemctl", "reset-failed", "lukepanel-ufw-recovery.service")
	}
	_ = os.Remove("/run/lukepanel/ufw-recovery.pending")
	return nil
}

func DisableUFW(ctx context.Context) error {
	out, err := commandOutput(ctx, "ufw", "--force", "disable")
	if err != nil {
		return fmt.Errorf("关闭 UFW 失败: %s", strings.TrimSpace(out))
	}
	return ConfirmUFW(ctx)
}

func AddUFWRule(ctx context.Context, request FirewallRuleRequest) (FirewallStatus, error) {
	if _, err := exec.LookPath("ufw"); err != nil {
		return FirewallStatus{}, errors.New("UFW 未安装")
	}
	request.Action = strings.ToLower(strings.TrimSpace(request.Action))
	request.Direction = strings.ToLower(strings.TrimSpace(request.Direction))
	request.Protocol = strings.ToLower(strings.TrimSpace(request.Protocol))
	request.Port = strings.TrimSpace(request.Port)
	request.Source = strings.TrimSpace(request.Source)
	request.Comment = strings.TrimSpace(request.Comment)
	if request.Action != "allow" && request.Action != "deny" && request.Action != "reject" && request.Action != "limit" {
		return FirewallStatus{}, errors.New("规则动作无效")
	}
	if request.Direction != "in" && request.Direction != "out" {
		return FirewallStatus{}, errors.New("规则方向无效")
	}
	if request.Protocol == "" {
		request.Protocol = "tcp"
	}
	if request.Protocol != "tcp" && request.Protocol != "udp" && request.Protocol != "any" {
		return FirewallStatus{}, errors.New("协议只支持 TCP、UDP 或任意")
	}
	if !firewallPortPattern.MatchString(request.Port) {
		return FirewallStatus{}, errors.New("端口必须是单个端口或端口范围")
	}
	for _, p := range strings.Split(request.Port, ":") {
		n, _ := strconv.Atoi(p)
		if n < 1 || n > 65535 {
			return FirewallStatus{}, errors.New("端口必须是 1-65535")
		}
	}
	if request.Source != "" && request.Source != "any" {
		if _, _, err := net.ParseCIDR(request.Source); err != nil && net.ParseIP(request.Source) == nil {
			return FirewallStatus{}, errors.New("来源必须是有效 IP 或 CIDR")
		}
	}
	args := []string{request.Direction, request.Action}
	if request.Source != "" && request.Source != "any" {
		args = append(args, "from", request.Source)
	}
	args = append(args, "to", "any", "port", request.Port)
	if request.Protocol != "any" {
		args = append(args, "proto", request.Protocol)
	}
	if request.Comment != "" {
		if len(request.Comment) > 80 || strings.ContainsAny(request.Comment, "\x00\r\n") {
			return FirewallStatus{}, errors.New("备注无效")
		}
		args = append(args, "comment", request.Comment)
	}
	out, err := commandOutput(ctx, "ufw", args...)
	if err != nil {
		return FirewallStatus{}, fmt.Errorf("添加规则失败: %s", strings.TrimSpace(out))
	}
	return FirewallInfo(ctx), nil
}

func DeleteUFWRule(ctx context.Context, number int) (FirewallStatus, error) {
	if number < 1 || number > 9999 {
		return FirewallStatus{}, errors.New("规则编号无效")
	}
	out, err := commandOutput(ctx, "ufw", "--force", "delete", strconv.Itoa(number))
	if err != nil {
		return FirewallStatus{}, fmt.Errorf("删除规则失败: %s", strings.TrimSpace(out))
	}
	return FirewallInfo(ctx), nil
}

func scheduleUFWRecovery(ctx context.Context) error {
	if err := os.MkdirAll("/run/lukepanel", 0o750); err != nil {
		return err
	}
	if err := os.WriteFile("/run/lukepanel/ufw-recovery.pending", []byte(time.Now().UTC().Format(time.RFC3339)), 0o600); err != nil {
		return err
	}
	service := `[Unit]
Description=LukePanel temporary UFW recovery
[Service]
Type=oneshot
ExecStart=/bin/sh -c '/usr/sbin/ufw --force disable; rm -f /run/lukepanel/ufw-recovery.pending'
`
	timer := `[Unit]
Description=Disable UFW unless LukePanel confirms connectivity
[Timer]
OnActiveSec=5min
Unit=lukepanel-ufw-recovery.service
AccuracySec=5s
[Install]
WantedBy=timers.target
`
	if err := os.WriteFile("/run/systemd/system/lukepanel-ufw-recovery.service", []byte(service), 0o644); err != nil {
		return err
	}
	if err := os.WriteFile("/run/systemd/system/lukepanel-ufw-recovery.timer", []byte(timer), 0o644); err != nil {
		return err
	}
	if out, err := commandOutput(ctx, "systemctl", "daemon-reload"); err != nil {
		return fmt.Errorf("systemd reload: %s", out)
	}
	if out, err := commandOutput(ctx, "systemctl", "start", "lukepanel-ufw-recovery.timer"); err != nil {
		return fmt.Errorf("recovery timer: %s", out)
	}
	return nil
}

func parseUFWRules(output string) []FirewallRule {
	var rules []FirewallRule
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "[") {
			continue
		}
		end := strings.Index(line, "]")
		if end < 2 {
			continue
		}
		number, _ := strconv.Atoi(strings.TrimSpace(line[1:end]))
		rest := strings.TrimSpace(line[end+1:])
		if number < 1 || rest == "" {
			continue
		}
		fields := strings.Fields(rest)
		actionIndex := -1
		for i, value := range fields {
			upper := strings.ToUpper(value)
			if upper == "ALLOW" || upper == "DENY" || upper == "REJECT" || upper == "LIMIT" {
				actionIndex = i
				break
			}
		}
		if actionIndex < 1 {
			continue
		}
		to := strings.Join(fields[:actionIndex], " ")
		action := fields[actionIndex]
		from := "Anywhere"
		if actionIndex+1 < len(fields) {
			from = strings.Join(fields[actionIndex+1:], " ")
		}
		version := "IPv4"
		if strings.Contains(to, "(v6)") || strings.Contains(from, "(v6)") {
			version = "IPv6"
		}
		rules = append(rules, FirewallRule{Number: number, To: to, Action: action, From: from, Version: version})
	}
	sort.Slice(rules, func(i, j int) bool { return rules[i].Number < rules[j].Number })
	return rules
}

func NTPStatus(ctx context.Context) map[string]any {
	out := map[string]any{"available": false, "enabled": false, "synchronized": false}
	if _, err := exec.LookPath("timedatectl"); err != nil {
		return out
	}
	out["available"] = true
	text, err := commandOutput(ctx, "timedatectl", "show", "--property=NTP", "--property=NTPSynchronized", "--property=Timezone", "--value")
	if err != nil {
		out["error"] = strings.TrimSpace(text)
		return out
	}
	lines := strings.Split(strings.TrimSpace(text), "\n")
	if len(lines) > 0 {
		out["enabled"] = strings.EqualFold(strings.TrimSpace(lines[0]), "yes")
	}
	if len(lines) > 1 {
		out["synchronized"] = strings.EqualFold(strings.TrimSpace(lines[1]), "yes")
	}
	if len(lines) > 2 {
		out["timezone"] = strings.TrimSpace(lines[2])
	}
	return out
}

func SetNTP(ctx context.Context, enabled bool) (map[string]any, error) {
	value := "false"
	if enabled {
		value = "true"
	}
	out, err := commandOutput(ctx, "timedatectl", "set-ntp", value)
	if err != nil {
		return nil, fmt.Errorf("设置时间同步失败: %s", strings.TrimSpace(out))
	}
	time.Sleep(500 * time.Millisecond)
	return NTPStatus(ctx), nil
}

type SoftwareSource struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
	Format  string `json:"format"`
	Content string `json:"content"`
}

func ListSoftwareSources() ([]SoftwareSource, error) {
	paths := []string{"/etc/apt/sources.list"}
	matches, _ := filepath.Glob("/etc/apt/sources.list.d/*")
	paths = append(paths, matches...)
	var out []SoftwareSource
	for _, path := range paths {
		info, err := os.Stat(path)
		if err != nil || info.IsDir() || info.Size() > 1<<20 {
			continue
		}
		name := filepath.Base(path)
		format := "list"
		if strings.HasSuffix(name, ".sources") {
			format = "deb822"
		} else if !(path == "/etc/apt/sources.list" || strings.HasSuffix(name, ".list") || strings.Contains(name, ".lukepanel-disabled")) {
			continue
		}
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		enabled := !strings.HasSuffix(path, ".lukepanel-disabled")
		out = append(out, SoftwareSource{Path: path, Name: name, Enabled: enabled, Format: format, Content: string(data)})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Path < out[j].Path })
	return out, nil
}

func SetSoftwareSourceEnabled(path string, enabled bool) (string, error) {
	path = filepath.Clean(strings.TrimSpace(path))
	if path != "/etc/apt/sources.list" && !strings.HasPrefix(path, "/etc/apt/sources.list.d/") {
		return "", errors.New("软件源路径无效")
	}
	if strings.ContainsAny(path, "\x00\r\n") {
		return "", errors.New("软件源路径无效")
	}
	if path == "/etc/apt/sources.list" {
		data, err := os.ReadFile(path)
		if err != nil {
			return "", err
		}
		var lines []string
		for _, line := range strings.Split(string(data), "\n") {
			trim := strings.TrimSpace(line)
			if enabled && strings.HasPrefix(trim, "# lukepanel-disabled ") {
				prefix := line[:len(line)-len(strings.TrimLeft(line, " \t"))]
				line = prefix + strings.TrimPrefix(trim, "# lukepanel-disabled ")
			}
			if !enabled && (strings.HasPrefix(trim, "deb ") || strings.HasPrefix(trim, "deb-src ")) {
				prefix := line[:len(line)-len(strings.TrimLeft(line, " \t"))]
				line = prefix + "# lukepanel-disabled " + trim
			}
			lines = append(lines, line)
		}
		return path, os.WriteFile(path, []byte(strings.Join(lines, "\n")), 0o644)
	}
	disabledPath := path
	if enabled {
		if !strings.HasSuffix(path, ".lukepanel-disabled") {
			return path, nil
		}
		disabledPath = strings.TrimSuffix(path, ".lukepanel-disabled")
	} else {
		if strings.HasSuffix(path, ".lukepanel-disabled") {
			return path, nil
		}
		disabledPath = path + ".lukepanel-disabled"
	}
	if err := os.Rename(path, disabledPath); err != nil {
		return "", err
	}
	return disabledPath, nil
}

func AddSoftwareSource(name, content string) (SoftwareSource, error) {
	name = strings.TrimSpace(name)
	content = strings.TrimSpace(content)
	if !regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`).MatchString(name) {
		return SoftwareSource{}, errors.New("软件源名称无效")
	}
	if len(content) < 5 || len(content) > 1<<20 || strings.ContainsRune(content, '\x00') {
		return SoftwareSource{}, errors.New("软件源内容无效")
	}
	format := "list"
	ext := ".list"
	if strings.Contains(content, "Types:") && strings.Contains(content, "URIs:") {
		format = "deb822"
		ext = ".sources"
	} else {
		valid := false
		for _, line := range strings.Split(content, "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			if !(strings.HasPrefix(line, "deb ") || strings.HasPrefix(line, "deb-src ")) {
				return SoftwareSource{}, errors.New("传统软件源每行必须以 deb 或 deb-src 开头")
			}
			if !strings.Contains(line, "https://") {
				return SoftwareSource{}, errors.New("新增软件源必须使用 HTTPS")
			}
			valid = true
		}
		if !valid {
			return SoftwareSource{}, errors.New("没有有效软件源条目")
		}
	}
	path := filepath.Join("/etc/apt/sources.list.d", name+ext)
	if _, err := os.Stat(path); err == nil {
		return SoftwareSource{}, errors.New("同名软件源已存在")
	}
	if err := os.WriteFile(path, []byte(content+"\n"), 0o644); err != nil {
		return SoftwareSource{}, err
	}
	return SoftwareSource{Path: path, Name: filepath.Base(path), Enabled: true, Format: format, Content: content + "\n"}, nil
}

func RemoveSoftwareSource(path string) error {
	path = filepath.Clean(strings.TrimSpace(path))
	if !strings.HasPrefix(path, "/etc/apt/sources.list.d/") || path == "/etc/apt/sources.list.d" {
		return errors.New("只允许删除 sources.list.d 中的自定义软件源")
	}
	return os.Remove(path)
}

func validateSourceContent(content string) error {
	cmd := exec.Command("apt-get", "indextargets")
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	_ = content
	return nil
}
