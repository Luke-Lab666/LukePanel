package system

import (
	"bufio"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

type Overview struct {
	Hostname     string  `json:"hostname"`
	OS           string  `json:"os"`
	Kernel       string  `json:"kernel"`
	Architecture string  `json:"architecture"`
	CPUCores     int     `json:"cpu_cores"`
	Uptime       uint64  `json:"uptime_seconds"`
	Load1        float64 `json:"load_1"`
	Load5        float64 `json:"load_5"`
	Load15       float64 `json:"load_15"`
	CPUPercent   float64 `json:"cpu_percent"`
	Memory       Memory  `json:"memory"`
	Disk         Disk    `json:"disk"`
	Network      Network `json:"network"`
	CollectedAt  string  `json:"collected_at"`
}

type Memory struct{ Total, Used, Available, SwapTotal, SwapUsed uint64 }
type Disk struct{ Total, Used, Available uint64 }
type Network struct {
	ReceivedBytes uint64  `json:"received_bytes"`
	SentBytes     uint64  `json:"sent_bytes"`
	DownloadBPS   float64 `json:"download_bps"`
	UploadBPS     float64 `json:"upload_bps"`
}

type Collector struct {
	mu              sync.Mutex
	previousCPU     cpuSample
	previousNetwork networkSample
}
type cpuSample struct {
	total, idle uint64
	at          time.Time
}
type networkSample struct {
	received, sent uint64
	at             time.Time
}

func NewCollector() *Collector { return &Collector{} }

func (c *Collector) Collect() (Overview, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	hostname, _ := os.Hostname()
	osName := readOSName()
	kernel := readKernel()
	uptime := readUptime()
	loads := readLoad()
	memory := readMemory()
	disk := readDisk("/")
	network := c.readNetworkRates()
	cpu := c.readCPUPercent()
	return Overview{Hostname: hostname, OS: osName, Kernel: kernel, Architecture: runtime.GOARCH, CPUCores: runtime.NumCPU(), Uptime: uptime,
		Load1: loads[0], Load5: loads[1], Load15: loads[2], CPUPercent: cpu, Memory: memory, Disk: disk, Network: network,
		CollectedAt: time.Now().UTC().Format(time.RFC3339)}, nil
}

func readOSName() string {
	f, err := os.Open("/etc/os-release")
	if err != nil {
		return runtime.GOOS
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		if strings.HasPrefix(s.Text(), "PRETTY_NAME=") {
			return strings.Trim(strings.TrimPrefix(s.Text(), "PRETTY_NAME="), "\"")
		}
	}
	return runtime.GOOS
}
func readKernel() string {
	b, err := os.ReadFile("/proc/sys/kernel/osrelease")
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(b))
}
func readUptime() uint64 {
	b, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	f := strings.Fields(string(b))
	if len(f) == 0 {
		return 0
	}
	v, _ := strconv.ParseFloat(f[0], 64)
	return uint64(v)
}
func readLoad() [3]float64 {
	var out [3]float64
	b, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return out
	}
	f := strings.Fields(string(b))
	for i := 0; i < 3 && i < len(f); i++ {
		out[i], _ = strconv.ParseFloat(f[i], 64)
	}
	return out
}
func readMemory() Memory {
	m := map[string]uint64{}
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return Memory{}
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		p := strings.Fields(s.Text())
		if len(p) >= 2 {
			v, _ := strconv.ParseUint(p[1], 10, 64)
			m[strings.TrimSuffix(p[0], ":")] = v * 1024
		}
	}
	used := m["MemTotal"] - m["MemAvailable"]
	swapUsed := m["SwapTotal"] - m["SwapFree"]
	return Memory{m["MemTotal"], used, m["MemAvailable"], m["SwapTotal"], swapUsed}
}
func readDisk(path string) Disk {
	var st syscall.Statfs_t
	if syscall.Statfs(path, &st) != nil {
		return Disk{}
	}
	total := st.Blocks * uint64(st.Bsize)
	available := st.Bavail * uint64(st.Bsize)
	return Disk{total, total - available, available}
}
func readNetworkTotals() (uint64, uint64) {
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0
	}
	defer f.Close()
	var received, sent uint64
	s := bufio.NewScanner(f)
	for s.Scan() {
		line := strings.TrimSpace(s.Text())
		if !strings.Contains(line, ":") {
			continue
		}
		parts := strings.Fields(strings.Replace(line, ":", " ", 1))
		if len(parts) < 17 || parts[0] == "lo" {
			continue
		}
		rx, _ := strconv.ParseUint(parts[1], 10, 64)
		tx, _ := strconv.ParseUint(parts[9], 10, 64)
		received += rx
		sent += tx
	}
	return received, sent
}
func (c *Collector) readNetworkRates() Network {
	received, sent := readNetworkTotals()
	now := time.Now()
	previous := c.previousNetwork
	c.previousNetwork = networkSample{received: received, sent: sent, at: now}
	n := Network{ReceivedBytes: received, SentBytes: sent}
	if previous.at.IsZero() {
		return n
	}
	seconds := now.Sub(previous.at).Seconds()
	if seconds <= 0 {
		return n
	}
	if received >= previous.received {
		n.DownloadBPS = float64(received-previous.received) / seconds
	}
	if sent >= previous.sent {
		n.UploadBPS = float64(sent-previous.sent) / seconds
	}
	return n
}
func (c *Collector) readCPUPercent() float64 {
	b, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0
	}
	line := strings.SplitN(string(b), "\n", 2)[0]
	f := strings.Fields(line)
	if len(f) < 5 || f[0] != "cpu" {
		return 0
	}
	vals := make([]uint64, 0, len(f)-1)
	for _, v := range f[1:] {
		n, e := strconv.ParseUint(v, 10, 64)
		if e != nil {
			return 0
		}
		vals = append(vals, n)
	}
	if len(vals) < 4 {
		return 0
	}
	idle := vals[3]
	if len(vals) > 4 {
		idle += vals[4]
	}
	var total uint64
	for _, v := range vals {
		total += v
	}
	now := time.Now()
	current := cpuSample{total: total, idle: idle, at: now}
	previous := c.previousCPU
	c.previousCPU = current
	if previous.at.IsZero() || total <= previous.total {
		return 0
	}
	deltaTotal := total - previous.total
	deltaIdle := idle - previous.idle
	if deltaTotal == 0 {
		return 0
	}
	return float64(deltaTotal-deltaIdle) / float64(deltaTotal) * 100
}
