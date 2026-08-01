package systemadmin

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

type Process struct {
	PID         int     `json:"pid"`
	User        string  `json:"user"`
	State       string  `json:"state"`
	Command     string  `json:"command"`
	CPUPercent  float64 `json:"cpu_percent"`
	MemoryBytes uint64  `json:"memory_bytes"`
}

type processSample struct{ ticks uint64 }
type ProcessManager struct {
	mu            sync.Mutex
	previousTotal uint64
	previous      map[int]processSample
	users         map[uint32]string
}

func NewProcessManager() *ProcessManager {
	return &ProcessManager{previous: map[int]processSample{}, users: map[uint32]string{}}
}

func (m *ProcessManager) List() ([]Process, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	total := readTotalTicks()
	deltaTotal := total - m.previousTotal
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return nil, err
	}
	current := map[int]processSample{}
	out := make([]Process, 0, 256)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		pid, err := strconv.Atoi(entry.Name())
		if err != nil {
			continue
		}
		p, ticks, ok := m.readProcess(pid)
		if !ok {
			continue
		}
		current[pid] = processSample{ticks: ticks}
		if prev, exists := m.previous[pid]; exists && deltaTotal > 0 && ticks >= prev.ticks {
			p.CPUPercent = float64(ticks-prev.ticks) / float64(deltaTotal) * 100 * float64(runtime.NumCPU())
		}
		out = append(out, p)
	}
	m.previousTotal = total
	m.previous = current
	sort.Slice(out, func(i, j int) bool {
		if out[i].CPUPercent != out[j].CPUPercent {
			return out[i].CPUPercent > out[j].CPUPercent
		}
		if out[i].MemoryBytes != out[j].MemoryBytes {
			return out[i].MemoryBytes > out[j].MemoryBytes
		}
		return out[i].PID < out[j].PID
	})
	if len(out) > 500 {
		out = out[:500]
	}
	return out, nil
}
func (m *ProcessManager) readProcess(pid int) (Process, uint64, bool) {
	base := filepath.Join("/proc", strconv.Itoa(pid))
	data, err := os.ReadFile(filepath.Join(base, "stat"))
	if err != nil {
		return Process{}, 0, false
	}
	text := string(data)
	right := strings.LastIndex(text, ")")
	left := strings.Index(text, "(")
	if left < 0 || right < left {
		return Process{}, 0, false
	}
	comm := text[left+1 : right]
	fields := strings.Fields(text[right+1:])
	if len(fields) < 22 {
		return Process{}, 0, false
	}
	utime, _ := strconv.ParseUint(fields[11], 10, 64)
	stime, _ := strconv.ParseUint(fields[12], 10, 64)
	rss, _ := strconv.ParseInt(fields[21], 10, 64)
	cmd := comm
	if raw, err := os.ReadFile(filepath.Join(base, "cmdline")); err == nil && len(raw) > 0 {
		cmd = strings.TrimSpace(strings.ReplaceAll(string(raw), "\x00", " "))
	}
	info, err := os.Stat(base)
	if err != nil {
		return Process{}, 0, false
	}
	uid := uint32(0)
	if st, ok := info.Sys().(*syscall.Stat_t); ok {
		uid = st.Uid
	}
	username := m.username(uid)
	return Process{PID: pid, User: username, State: fields[0], Command: cmd, MemoryBytes: uint64(max64(rss, 0)) * uint64(os.Getpagesize())}, utime + stime, true
}
func (m *ProcessManager) username(uid uint32) string {
	if name, ok := m.users[uid]; ok {
		return name
	}
	u, err := user.LookupId(strconv.FormatUint(uint64(uid), 10))
	name := strconv.FormatUint(uint64(uid), 10)
	if err == nil {
		name = u.Username
	}
	m.users[uid] = name
	return name
}
func (m *ProcessManager) Signal(pid int, signal string) error {
	if pid <= 1 || pid == os.Getpid() {
		return errors.New("禁止结束该系统进程")
	}
	sig := syscall.SIGTERM
	if signal == "kill" {
		sig = syscall.SIGKILL
	} else if signal != "term" {
		return errors.New("不支持的信号")
	}
	return syscall.Kill(pid, sig)
}
func readTotalTicks() uint64 {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0
	}
	line := strings.SplitN(string(data), "\n", 2)[0]
	fields := strings.Fields(line)
	var total uint64
	for _, v := range fields[1:] {
		n, _ := strconv.ParseUint(v, 10, 64)
		total += n
	}
	return total
}
func max64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

type Interface struct {
	Name          string   `json:"name"`
	MTU           int      `json:"mtu"`
	Flags         string   `json:"flags"`
	Addresses     []string `json:"addresses"`
	ReceivedBytes uint64   `json:"received_bytes"`
	SentBytes     uint64   `json:"sent_bytes"`
}
type NetworkInfo struct {
	Interfaces []Interface `json:"interfaces"`
	Listening  string      `json:"listening"`
}

func Network(ctx context.Context) (NetworkInfo, error) {
	counters := readNetCounters()
	interfaces, err := net.Interfaces()
	out := make([]Interface, 0, len(counters))
	if err == nil {
		for _, iface := range interfaces {
			addrs, _ := iface.Addrs()
			a := make([]string, 0, len(addrs))
			for _, addr := range addrs {
				a = append(a, addr.String())
			}
			c := counters[iface.Name]
			out = append(out, Interface{Name: iface.Name, MTU: iface.MTU, Flags: iface.Flags.String(), Addresses: a, ReceivedBytes: c[0], SentBytes: c[1]})
		}
	} else {
		// Hardened systemd sandboxes can block AF_NETLINK on an older unit file.
		// Fall back to sysfs so the page still shows interfaces instead of failing
		// completely; the installer now explicitly allows AF_NETLINK for full data.
		entries, readErr := os.ReadDir("/sys/class/net")
		if readErr != nil {
			return NetworkInfo{}, err
		}
		for _, entry := range entries {
			name := entry.Name()
			mtuRaw, _ := os.ReadFile(filepath.Join("/sys/class/net", name, "mtu"))
			mtu, _ := strconv.Atoi(strings.TrimSpace(string(mtuRaw)))
			c := counters[name]
			out = append(out, Interface{Name: name, MTU: mtu, Flags: "地址读取受限", Addresses: nil, ReceivedBytes: c[0], SentBytes: c[1]})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	listen, listenErr := run(ctx, 12*time.Second, "ss", "-lntupH")
	if listenErr != nil {
		listen = "监听端口读取失败：" + listenErr.Error()
	}
	return NetworkInfo{Interfaces: out, Listening: listen}, nil
}
func readNetCounters() map[string][2]uint64 {
	out := map[string][2]uint64{}
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return out
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		line := strings.TrimSpace(s.Text())
		if !strings.Contains(line, ":") {
			continue
		}
		parts := strings.Fields(strings.Replace(line, ":", " ", 1))
		if len(parts) < 17 {
			continue
		}
		rx, _ := strconv.ParseUint(parts[1], 10, 64)
		tx, _ := strconv.ParseUint(parts[9], 10, 64)
		out[parts[0]] = [2]uint64{rx, tx}
	}
	return out
}

type Mount struct {
	Device     string `json:"device"`
	Mountpoint string `json:"mountpoint"`
	Filesystem string `json:"filesystem"`
	Total      uint64 `json:"total"`
	Used       uint64 `json:"used"`
	Available  uint64 `json:"available"`
	Virtual    bool   `json:"virtual"`
}

func Storage() ([]Mount, error) {
	f, err := os.Open("/proc/mounts")
	if err != nil {
		return nil, err
	}
	defer f.Close()
	skip := map[string]bool{"proc": true, "sysfs": true, "devtmpfs": true, "devpts": true, "tmpfs": true, "cgroup": true, "cgroup2": true, "squashfs": true, "securityfs": true, "pstore": true, "debugfs": true, "tracefs": true, "mqueue": true, "hugetlbfs": true, "configfs": true, "fusectl": true, "autofs": true}
	seen := map[string]bool{}
	seenStorage := map[string]bool{}
	out := []Mount{}
	s := bufio.NewScanner(f)
	for s.Scan() {
		fields := strings.Fields(s.Text())
		if len(fields) < 3 || skip[fields[2]] {
			continue
		}
		mount := strings.ReplaceAll(fields[1], "\\040", " ")
		if seen[mount] {
			continue
		}
		seen[mount] = true
		var st syscall.Statfs_t
		if syscall.Statfs(mount, &st) != nil {
			continue
		}
		total := st.Blocks * uint64(st.Bsize)
		available := st.Bavail * uint64(st.Bsize)
		used := (st.Blocks - st.Bfree) * uint64(st.Bsize)
		storageKey := fmt.Sprintf("%s|%s|%d|%d", fields[0], fields[2], st.Blocks, st.Bsize)
		duplicate := seenStorage[storageKey]
		seenStorage[storageKey] = true
		out = append(out, Mount{Device: fields[0], Mountpoint: mount, Filesystem: fields[2], Total: total, Used: used, Available: available, Virtual: duplicate || virtualMount(fields[2], mount)})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Mountpoint < out[j].Mountpoint })
	return out, s.Err()
}

type UpdateInfo struct {
	Available bool     `json:"available"`
	Count     int      `json:"count"`
	Packages  []string `json:"packages"`
	Output    string   `json:"output,omitempty"`
}

func virtualMount(filesystem, mountpoint string) bool {
	// The root filesystem is always meaningful, even when LukePanel itself runs
	// inside a container where / is backed by overlayfs.
	if mountpoint == "/" {
		return false
	}
	virtualFS := map[string]bool{"overlay": true, "nsfs": true, "bpf": true, "binfmt_misc": true, "ramfs": true, "fuse.portal": true}
	if virtualFS[filesystem] {
		return true
	}
	for _, exact := range []string{"/etc/hostname", "/etc/hosts", "/etc/resolv.conf"} {
		if mountpoint == exact {
			return true
		}
	}
	for _, prefix := range []string{"/proc/", "/sys/", "/dev/", "/run/docker/netns/", "/var/lib/docker/overlay2/"} {
		if strings.HasPrefix(mountpoint, prefix) {
			return true
		}
	}
	return false
}

func CheckUpdates(ctx context.Context) (UpdateInfo, error) {
	if _, err := exec.LookPath("apt-get"); err != nil {
		return UpdateInfo{Available: false, Output: "当前系统未安装 apt-get"}, nil
	}
	out, err := run(ctx, 90*time.Second, "apt-get", "-s", "-o", "Debug::NoLocking=1", "upgrade")
	if err != nil {
		return UpdateInfo{}, err
	}
	packages := []string{}
	for _, line := range strings.Split(out, "\n") {
		if strings.HasPrefix(line, "Inst ") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				packages = append(packages, fields[1])
			}
		}
	}
	if len(packages) > 200 {
		packages = packages[:200]
	}
	return UpdateInfo{Available: true, Count: len(packages), Packages: packages}, nil
}
func Timers(ctx context.Context) (string, error) {
	return run(ctx, 20*time.Second, "systemctl", "list-timers", "--all", "--no-pager", "--plain")
}
func run(parent context.Context, timeout time.Duration, name string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, name, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return "", fmt.Errorf("%s", message)
	}
	return stdout.String(), nil
}
