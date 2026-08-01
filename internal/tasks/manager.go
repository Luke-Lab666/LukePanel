package tasks

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

var safeName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.@-]{0,127}$`)

type Task struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Target    string    `json:"target"`
	Frequency string    `json:"frequency"`
	Hour      int       `json:"hour"`
	Minute    int       `json:"minute"`
	Weekday   int       `json:"weekday"`
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"created_at"`
	NextRun   string    `json:"next_run,omitempty"`
	LastRun   string    `json:"last_run,omitempty"`
}

type CreateRequest struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	Target    string `json:"target"`
	Frequency string `json:"frequency"`
	Hour      int    `json:"hour"`
	Minute    int    `json:"minute"`
	Weekday   int    `json:"weekday"`
}

type Manager struct {
	dataDir string
	unitDir string
}

func New(dataDir string) *Manager {
	return &Manager{dataDir: filepath.Join(dataDir, "tasks"), unitDir: "/etc/systemd/system"}
}

func (m *Manager) List(ctx context.Context) ([]Task, error) {
	entries, err := os.ReadDir(m.dataDir)
	if errors.Is(err, os.ErrNotExist) {
		return []Task{}, nil
	}
	if err != nil {
		return nil, err
	}
	out := make([]Task, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(m.dataDir, entry.Name()))
		if err != nil {
			continue
		}
		var task Task
		if json.Unmarshal(raw, &task) != nil || task.ID == "" {
			continue
		}
		task.Enabled = unitEnabled(ctx, timerUnit(task.ID))
		task.NextRun, task.LastRun = timerTimes(ctx, task.ID)
		out = append(out, task)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (m *Manager) Create(ctx context.Context, req CreateRequest) (Task, error) {
	if err := validateRequest(&req); err != nil {
		return Task{}, err
	}
	id := fmt.Sprintf("%d", time.Now().UTC().UnixNano())
	if len(id) > 12 {
		id = id[len(id)-12:]
	}
	task := Task{ID: id, Name: req.Name, Type: req.Type, Target: req.Target, Frequency: req.Frequency, Hour: req.Hour, Minute: req.Minute, Weekday: req.Weekday, Enabled: true, CreatedAt: time.Now().UTC()}
	service, timer, err := renderUnits(task)
	if err != nil {
		return Task{}, err
	}
	if err := os.MkdirAll(m.dataDir, 0o750); err != nil {
		return Task{}, err
	}
	if err := writeAtomic(filepath.Join(m.unitDir, serviceUnit(id)), []byte(service), 0o644); err != nil {
		return Task{}, err
	}
	if err := writeAtomic(filepath.Join(m.unitDir, timerUnit(id)), []byte(timer), 0o644); err != nil {
		_ = os.Remove(filepath.Join(m.unitDir, serviceUnit(id)))
		return Task{}, err
	}
	raw, _ := json.MarshalIndent(task, "", "  ")
	if err := writeAtomic(filepath.Join(m.dataDir, id+".json"), append(raw, '\n'), 0o600); err != nil {
		_ = os.Remove(filepath.Join(m.unitDir, serviceUnit(id)))
		_ = os.Remove(filepath.Join(m.unitDir, timerUnit(id)))
		return Task{}, err
	}
	cleanup := func() {
		_ = systemctl(context.Background(), "disable", "--now", timerUnit(id))
		_ = os.Remove(filepath.Join(m.unitDir, serviceUnit(id)))
		_ = os.Remove(filepath.Join(m.unitDir, timerUnit(id)))
		_ = os.Remove(filepath.Join(m.dataDir, id+".json"))
		_ = systemctl(context.Background(), "daemon-reload")
	}
	if err := systemctl(ctx, "daemon-reload"); err != nil {
		cleanup()
		return Task{}, err
	}
	if err := systemctl(ctx, "enable", "--now", timerUnit(id)); err != nil {
		cleanup()
		return Task{}, err
	}
	return task, nil
}

func (m *Manager) Action(ctx context.Context, id, action string) error {
	if !validID(id) {
		return errors.New("计划任务编号无效")
	}
	switch action {
	case "run":
		return systemctl(ctx, "start", serviceUnit(id))
	case "enable":
		return systemctl(ctx, "enable", "--now", timerUnit(id))
	case "disable":
		return systemctl(ctx, "disable", "--now", timerUnit(id))
	case "delete":
		_ = systemctl(ctx, "disable", "--now", timerUnit(id))
		if err := os.Remove(filepath.Join(m.unitDir, timerUnit(id))); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		if err := os.Remove(filepath.Join(m.unitDir, serviceUnit(id))); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		_ = os.Remove(filepath.Join(m.dataDir, id+".json"))
		return systemctl(ctx, "daemon-reload")
	default:
		return errors.New("不支持的计划任务操作")
	}
}

func validateRequest(req *CreateRequest) error {
	req.Name = strings.TrimSpace(req.Name)
	req.Type = strings.TrimSpace(req.Type)
	req.Target = strings.TrimSpace(req.Target)
	req.Frequency = strings.TrimSpace(req.Frequency)
	if req.Name == "" || len(req.Name) > 80 || strings.ContainsAny(req.Name, "\r\n") {
		return errors.New("任务名称必须是 1-80 个字符")
	}
	if req.Minute < 0 || req.Minute > 59 || req.Hour < 0 || req.Hour > 23 || req.Weekday < 0 || req.Weekday > 6 {
		return errors.New("执行时间无效")
	}
	if req.Frequency != "hourly" && req.Frequency != "daily" && req.Frequency != "weekly" {
		return errors.New("执行频率无效")
	}
	switch req.Type {
	case "service-restart":
		if !safeName.MatchString(req.Target) || !strings.HasSuffix(req.Target, ".service") {
			return errors.New("systemd 服务名称无效")
		}
	case "docker-restart":
		if !safeName.MatchString(req.Target) {
			return errors.New("Docker 容器名称无效")
		}
		if _, err := exec.LookPath("docker"); err != nil {
			return errors.New("服务器未安装 docker 命令")
		}
	case "docker-cleanup-safe":
		req.Target = "safe"
		if _, err := exec.LookPath("docker"); err != nil {
			return errors.New("服务器未安装 docker 命令")
		}
	default:
		return errors.New("任务类型无效")
	}
	return nil
}

func renderUnits(task Task) (string, string, error) {
	var executable string
	var args []string
	switch task.Type {
	case "service-restart":
		executable = "/usr/bin/systemctl"
		args = []string{"restart", task.Target}
	case "docker-restart":
		path, err := exec.LookPath("docker")
		if err != nil {
			return "", "", err
		}
		executable = path
		args = []string{"restart", task.Target}
	case "docker-cleanup-safe":
		path, err := exec.LookPath("docker")
		if err != nil {
			return "", "", err
		}
		executable = path
		args = []string{"system", "prune", "-f"}
	default:
		return "", "", errors.New("任务类型无效")
	}
	execLine := systemdEscapeArg(executable)
	for _, arg := range args {
		execLine += " " + systemdEscapeArg(arg)
	}
	service := fmt.Sprintf(`[Unit]
Description=LukePanel task: %s
After=network-online.target

[Service]
Type=oneshot
ExecStart=%s
NoNewPrivileges=true
`, escapeDescription(task.Name), execLine)
	timer := fmt.Sprintf(`[Unit]
Description=LukePanel schedule: %s

[Timer]
OnCalendar=%s
Persistent=true
AccuracySec=1min
RandomizedDelaySec=15s
Unit=%s

[Install]
WantedBy=timers.target
`, escapeDescription(task.Name), onCalendar(task), serviceUnit(task.ID))
	return service, timer, nil
}

func onCalendar(task Task) string {
	switch task.Frequency {
	case "hourly":
		return fmt.Sprintf("*-*-* *:%02d:00", task.Minute)
	case "weekly":
		days := []string{"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"}
		return fmt.Sprintf("%s *-*-* %02d:%02d:00", days[task.Weekday], task.Hour, task.Minute)
	default:
		return fmt.Sprintf("*-*-* %02d:%02d:00", task.Hour, task.Minute)
	}
}

func timerTimes(ctx context.Context, id string) (string, string) {
	cmd := exec.CommandContext(ctx, "systemctl", "show", timerUnit(id), "--property=NextElapseUSecRealtime", "--property=LastTriggerUSec", "--value")
	out, err := cmd.Output()
	if err != nil {
		return "", ""
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var next, last string
	if len(lines) > 0 {
		next = strings.TrimSpace(lines[0])
	}
	if len(lines) > 1 {
		last = strings.TrimSpace(lines[1])
	}
	return next, last
}

func unitEnabled(ctx context.Context, unit string) bool {
	cmd := exec.CommandContext(ctx, "systemctl", "is-enabled", "--quiet", unit)
	return cmd.Run() == nil
}

func systemctl(ctx context.Context, args ...string) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "systemctl", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		message := strings.TrimSpace(string(output))
		if message == "" {
			message = err.Error()
		}
		return errors.New(message)
	}
	return nil
}

func serviceUnit(id string) string { return "lukepanel-task-" + id + ".service" }
func timerUnit(id string) string   { return "lukepanel-task-" + id + ".timer" }
func validID(id string) bool {
	if len(id) < 4 || len(id) > 32 {
		return false
	}
	_, err := strconv.ParseUint(id, 10, 64)
	return err == nil
}
func systemdEscapeArg(value string) string {
	value = strings.ReplaceAll(value, "\\", "\\\\")
	value = strings.ReplaceAll(value, `"`, `\"`)
	return `"` + value + `"`
}
func escapeDescription(value string) string {
	return strings.NewReplacer("\n", " ", "\r", " ", "%", "%%").Replace(value)
}
func writeAtomic(path string, data []byte, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".lukepanel-task-*.tmp")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if err := tmp.Chmod(mode); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}
