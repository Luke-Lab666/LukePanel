package services

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

var unitPattern = regexp.MustCompile(`^[A-Za-z0-9_.@:-]+\.service$`)

type Service struct {
	Name        string `json:"name"`
	Load        string `json:"load"`
	Active      string `json:"active"`
	Sub         string `json:"sub"`
	Description string `json:"description"`
	Enabled     string `json:"enabled"`
}

type Manager struct{}

func New() *Manager { return &Manager{} }

func (m *Manager) List(ctx context.Context, query string) ([]Service, error) {
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	enabled := map[string]string{}
	if out, err := run(ctx, "systemctl", "list-unit-files", "--type=service", "--no-legend", "--no-pager", "--plain"); err == nil {
		for _, line := range strings.Split(out, "\n") {
			f := strings.Fields(line)
			if len(f) >= 2 {
				enabled[f[0]] = f[1]
			}
		}
	}
	out, err := run(ctx, "systemctl", "list-units", "--type=service", "--all", "--no-legend", "--no-pager", "--plain")
	if err != nil {
		return nil, err
	}
	query = strings.ToLower(strings.TrimSpace(query))
	services := make([]Service, 0, 128)
	for _, line := range strings.Split(out, "\n") {
		f := strings.Fields(line)
		if len(f) < 5 || !strings.HasSuffix(f[0], ".service") {
			continue
		}
		desc := strings.Join(f[4:], " ")
		if query != "" && !strings.Contains(strings.ToLower(f[0]+" "+desc), query) {
			continue
		}
		services = append(services, Service{Name: f[0], Load: f[1], Active: f[2], Sub: f[3], Description: desc, Enabled: enabled[f[0]]})
	}
	sort.Slice(services, func(i, j int) bool {
		if services[i].Active != services[j].Active {
			return services[i].Active == "active"
		}
		return services[i].Name < services[j].Name
	})
	if len(services) > 500 {
		services = services[:500]
	}
	return services, nil
}

func (m *Manager) Action(ctx context.Context, name, action string) error {
	if !unitPattern.MatchString(name) {
		return errors.New("invalid service name")
	}
	allowed := map[string]bool{"start": true, "stop": true, "restart": true, "reload": true, "enable": true, "disable": true}
	if !allowed[action] {
		return errors.New("unsupported service action")
	}
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	args := []string{action, name}
	if action == "enable" || action == "disable" {
		args = []string{action, "--now", name}
	}
	_, err := run(ctx, "systemctl", args...)
	return err
}

func (m *Manager) Logs(ctx context.Context, name string, lines int) (string, error) {
	if !unitPattern.MatchString(name) {
		return "", errors.New("invalid service name")
	}
	if lines < 1 || lines > 5000 {
		lines = 300
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	return run(ctx, "journalctl", "-u", name, "-n", strconv.Itoa(lines), "--no-pager", "-o", "short-iso")
}

func (m *Manager) SystemLogs(ctx context.Context, unit, priority string, lines int) (string, error) {
	if unit != "" && !unitPattern.MatchString(unit) {
		return "", errors.New("invalid service name")
	}
	if lines < 1 || lines > 5000 {
		lines = 300
	}
	args := []string{"-n", strconv.Itoa(lines), "--no-pager", "-o", "short-iso"}
	if unit != "" {
		args = append(args, "-u", unit)
	}
	if priority != "" {
		valid := map[string]bool{"emerg": true, "alert": true, "crit": true, "err": true, "warning": true, "notice": true, "info": true, "debug": true}
		if !valid[priority] {
			return "", errors.New("invalid log priority")
		}
		args = append(args, "-p", priority)
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	return run(ctx, "journalctl", args...)
}

func run(ctx context.Context, name string, args ...string) (string, error) {
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
