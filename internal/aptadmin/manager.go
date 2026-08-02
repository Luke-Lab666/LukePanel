package aptadmin

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/snapshots"
)

var packagePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9+.-]{0,127}(?::[a-z0-9][a-z0-9_-]{0,31})?$`)

type Manager struct {
	dataDir   string
	snapshots *snapshots.Manager
}

type Package struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Installed   bool   `json:"installed"`
	Version     string `json:"version,omitempty"`
}

type Preflight struct {
	Available      bool     `json:"available"`
	Locked         bool     `json:"locked"`
	LockDetail     string   `json:"lock_detail,omitempty"`
	UpgradeCount   int      `json:"upgrade_count"`
	InstallCount   int      `json:"install_count"`
	RemoveCount    int      `json:"remove_count"`
	DownloadBytes  int64    `json:"download_bytes"`
	DiskDeltaBytes int64    `json:"disk_delta_bytes"`
	Packages       []string `json:"packages"`
	RebootRequired bool     `json:"reboot_required"`
	Output         string   `json:"output,omitempty"`
}

type Result struct {
	OK              bool   `json:"ok"`
	Action          string `json:"action"`
	SnapshotID      string `json:"snapshot_id,omitempty"`
	RepairAttempted bool   `json:"repair_attempted,omitempty"`
	RebootRequired  bool   `json:"reboot_required"`
	Output          string `json:"output"`
}

func New(dataDir string, snapshotManager *snapshots.Manager) *Manager {
	return &Manager{dataDir: dataDir, snapshots: snapshotManager}
}

func (m *Manager) Available() bool {
	_, err := exec.LookPath("apt-get")
	return err == nil
}

func (m *Manager) Search(ctx context.Context, query string) ([]Package, error) {
	if !m.Available() {
		return nil, errors.New("当前系统没有 apt-get")
	}
	query = strings.TrimSpace(query)
	if len(query) < 2 || len(query) > 80 || strings.ContainsAny(query, "\x00\r\n") {
		return nil, errors.New("请输入 2-80 个字符的软件包关键词")
	}
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	output, err := exec.CommandContext(ctx, "apt-cache", "search", "--names-only", query).Output()
	if err != nil {
		return nil, fmt.Errorf("搜索软件包失败: %w", err)
	}
	items := []Package{}
	for _, line := range strings.Split(string(output), "\n") {
		name, description, ok := strings.Cut(line, " - ")
		name = strings.TrimSpace(name)
		if !ok || !packagePattern.MatchString(name) {
			continue
		}
		version, installed := installedVersion(ctx, name)
		items = append(items, Package{Name: name, Description: strings.TrimSpace(description), Installed: installed, Version: version})
		if len(items) >= 100 {
			break
		}
	}
	return items, nil
}

func (m *Manager) Preflight(ctx context.Context) (Preflight, error) {
	if !m.Available() {
		return Preflight{Available: false, Output: "当前系统没有 apt-get"}, nil
	}
	locked, detail := aptLocked()
	if locked {
		return Preflight{Available: true, Locked: true, LockDetail: detail, RebootRequired: rebootRequired()}, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	output, err := runCombined(ctx, nil, "apt-get", "-s", "-o", "Debug::NoLocking=1", "dist-upgrade")
	if err != nil {
		return Preflight{}, fmt.Errorf("APT 预检查失败: %s", tail(output, 16000))
	}
	result := parseSimulation(output)
	result.Available = true
	result.RebootRequired = rebootRequired()
	result.Output = tail(output, 24000)
	return result, nil
}

func (m *Manager) Download(ctx context.Context) (Result, error) {
	if err := m.ensureReady(); err != nil {
		return Result{}, err
	}
	if locked, detail := aptLocked(); locked {
		return Result{}, fmt.Errorf("APT 正被其他任务占用: %s", detail)
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Minute)
	defer cancel()
	var log bytes.Buffer
	if err := runLogged(ctx, &log, nil, "apt-get", "update"); err != nil {
		return Result{Action: "download", Output: tail(log.String(), 32000)}, errors.New("更新软件源失败")
	}
	if err := runLogged(ctx, &log, nil, "apt-get", "-y", "--download-only", "dist-upgrade"); err != nil {
		return Result{Action: "download", Output: tail(log.String(), 32000)}, errors.New("下载升级包失败")
	}
	return Result{OK: true, Action: "download", RebootRequired: rebootRequired(), Output: tail(log.String(), 32000)}, nil
}

func (m *Manager) Upgrade(ctx context.Context) (Result, error) {
	if err := m.ensureReady(); err != nil {
		return Result{}, err
	}
	if locked, detail := aptLocked(); locked {
		return Result{}, fmt.Errorf("APT 正被其他任务占用: %s", detail)
	}
	paths := []string{"/var/lib/dpkg/status", "/etc/apt", "/etc/default/grub", "/etc/kernel"}
	snapshot, err := m.snapshots.Create("apt", "APT 升级前", "保存 dpkg 状态和软件源配置；软件包本身无法保证自动降级", paths)
	if err != nil {
		return Result{}, fmt.Errorf("创建升级前快照失败: %w", err)
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()
	var log bytes.Buffer
	if err := runLogged(ctx, &log, nil, "dpkg", "--audit"); err != nil {
		return Result{Action: "upgrade", SnapshotID: snapshot.ID, Output: tail(log.String(), 32000)}, errors.New("dpkg 状态异常，请先修复再升级")
	}
	if err := runLogged(ctx, &log, nil, "apt-get", "update"); err != nil {
		return Result{Action: "upgrade", SnapshotID: snapshot.ID, Output: tail(log.String(), 32000)}, errors.New("更新软件源失败")
	}
	if err := runLogged(ctx, &log, nil, "apt-get", "-y", "--download-only", "dist-upgrade"); err != nil {
		return Result{Action: "upgrade", SnapshotID: snapshot.ID, Output: tail(log.String(), 32000)}, errors.New("下载升级包失败，系统尚未被修改")
	}
	env := []string{"DEBIAN_FRONTEND=noninteractive", "APT_LISTCHANGES_FRONTEND=none", "NEEDRESTART_MODE=a"}
	if err := runLogged(ctx, &log, env, "apt-get", "-y", "-o", "Dpkg::Options::=--force-confold", "dist-upgrade"); err != nil {
		result := Result{Action: "upgrade", SnapshotID: snapshot.ID, RepairAttempted: true}
		_ = runLogged(ctx, &log, nil, "dpkg", "--configure", "-a")
		_ = runLogged(ctx, &log, nil, "apt-get", "-f", "install", "-y")
		result.Output = tail(log.String(), 48000)
		return result, errors.New("升级过程中出现错误，已尝试执行 dpkg/apt 修复；请检查日志")
	}
	return Result{OK: true, Action: "upgrade", SnapshotID: snapshot.ID, RebootRequired: rebootRequired(), Output: tail(log.String(), 48000)}, nil
}

func (m *Manager) Install(ctx context.Context, packages []string) (Result, error) {
	return m.packageAction(ctx, "install", packages)
}

func (m *Manager) Remove(ctx context.Context, packages []string) (Result, error) {
	return m.packageAction(ctx, "remove", packages)
}

func (m *Manager) packageAction(ctx context.Context, action string, packages []string) (Result, error) {
	if err := m.ensureReady(); err != nil {
		return Result{}, err
	}
	clean, err := validatePackages(packages)
	if err != nil {
		return Result{}, err
	}
	if locked, detail := aptLocked(); locked {
		return Result{}, fmt.Errorf("APT 正被其他任务占用: %s", detail)
	}
	snapshot, err := m.snapshots.Create("apt", "APT "+action+" 前", strings.Join(clean, ", "), []string{"/var/lib/dpkg/status", "/etc/apt"})
	if err != nil {
		return Result{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Minute)
	defer cancel()
	var log bytes.Buffer
	args := append([]string{"-y", action}, clean...)
	if err := runLogged(ctx, &log, nil, "apt-get", args...); err != nil {
		return Result{Action: action, SnapshotID: snapshot.ID, Output: tail(log.String(), 32000)}, fmt.Errorf("APT %s 失败", action)
	}
	return Result{OK: true, Action: action, SnapshotID: snapshot.ID, RebootRequired: rebootRequired(), Output: tail(log.String(), 32000)}, nil
}

func (m *Manager) ensureReady() error {
	if os.Geteuid() != 0 {
		return errors.New("需要 root 权限执行 APT 操作")
	}
	if !m.Available() {
		return errors.New("当前系统没有 apt-get")
	}
	return nil
}

func parseSimulation(output string) Preflight {
	result := Preflight{}
	seen := map[string]bool{}
	for _, line := range strings.Split(output, "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 && fields[0] == "Inst" {
			name := fields[1]
			if !seen[name] {
				seen[name] = true
				result.Packages = append(result.Packages, name)
			}
			if strings.Contains(line, "[installed]") {
				result.InstallCount++
			} else {
				result.UpgradeCount++
			}
		}
		if len(fields) >= 2 && fields[0] == "Remv" {
			result.RemoveCount++
		}
		if strings.Contains(line, "Need to get ") {
			result.DownloadBytes = parseHumanBytesBetween(line, "Need to get ", " of archives")
		}
		if strings.Contains(line, "After this operation, ") {
			result.DiskDeltaBytes = parseHumanBytesBetween(line, "After this operation, ", " of additional disk space")
			if strings.Contains(line, " disk space will be freed") {
				result.DiskDeltaBytes = -parseHumanBytesBetween(line, "After this operation, ", " disk space will be freed")
			}
		}
	}
	sort.Strings(result.Packages)
	if len(result.Packages) > 300 {
		result.Packages = result.Packages[:300]
	}
	return result
}

func validatePackages(packages []string) ([]string, error) {
	if len(packages) == 0 || len(packages) > 20 {
		return nil, errors.New("一次请选择 1-20 个软件包")
	}
	seen := map[string]bool{}
	clean := []string{}
	for _, item := range packages {
		item = strings.ToLower(strings.TrimSpace(item))
		if !packagePattern.MatchString(item) {
			return nil, fmt.Errorf("软件包名称无效: %s", item)
		}
		if !seen[item] {
			seen[item] = true
			clean = append(clean, item)
		}
	}
	return clean, nil
}

func installedVersion(ctx context.Context, name string) (string, bool) {
	cmd := exec.CommandContext(ctx, "dpkg-query", "-W", "-f=${Status}\t${Version}", name)
	data, err := cmd.Output()
	if err != nil {
		return "", false
	}
	parts := strings.SplitN(string(data), "\t", 2)
	if len(parts) == 2 && strings.Contains(parts[0], "install ok installed") {
		return strings.TrimSpace(parts[1]), true
	}
	return "", false
}

func aptLocked() (bool, string) {
	paths := []string{"/var/lib/dpkg/lock-frontend", "/var/lib/dpkg/lock", "/var/cache/apt/archives/lock", "/var/lib/apt/lists/lock"}
	for _, path := range paths {
		file, err := os.OpenFile(path, os.O_RDONLY, 0)
		if err != nil {
			continue
		}
		err = syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
		if err == nil {
			_ = syscall.Flock(int(file.Fd()), syscall.LOCK_UN)
			_ = file.Close()
			continue
		}
		_ = file.Close()
		return true, filepath.Base(path)
	}
	return false, ""
}

func runLogged(ctx context.Context, log *bytes.Buffer, env []string, name string, args ...string) error {
	fmt.Fprintf(log, "\n$ %s %s\n", name, strings.Join(args, " "))
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive", "APT_LISTCHANGES_FRONTEND=none")
	cmd.Env = append(cmd.Env, env...)
	cmd.Stdout, cmd.Stderr = log, log
	return cmd.Run()
}

func runCombined(ctx context.Context, env []string, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = append(os.Environ(), env...)
	data, err := cmd.CombinedOutput()
	return string(data), err
}

func rebootRequired() bool {
	_, err := os.Stat("/var/run/reboot-required")
	return err == nil
}

func tail(value string, max int) string {
	if len(value) <= max {
		return value
	}
	return "…输出已截断…\n" + value[len(value)-max:]
}

func parseHumanBytesBetween(line, start, end string) int64 {
	index := strings.Index(line, start)
	if index < 0 {
		return 0
	}
	value := line[index+len(start):]
	if endIndex := strings.Index(value, end); endIndex >= 0 {
		value = value[:endIndex]
	}
	parts := strings.Fields(strings.ReplaceAll(value, ",", ""))
	if len(parts) < 2 {
		return 0
	}
	var number float64
	if _, err := fmt.Sscanf(parts[0], "%f", &number); err != nil {
		return 0
	}
	unit := strings.ToUpper(parts[1])
	multiplier := float64(1)
	switch unit {
	case "KB", "KIB":
		multiplier = 1024
	case "MB", "MIB":
		multiplier = 1024 * 1024
	case "GB", "GIB":
		multiplier = 1024 * 1024 * 1024
	case "TB", "TIB":
		multiplier = 1024 * 1024 * 1024 * 1024
	}
	return int64(number * multiplier)
}
