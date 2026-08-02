package hostadmin

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/config"
	"github.com/Luke-Lab666/LukePanel/internal/sshadmin"
)

type InstallResult struct {
	Installed bool   `json:"installed"`
	Version   string `json:"version,omitempty"`
	Compose   string `json:"compose,omitempty"`
	Output    string `json:"output,omitempty"`
}

type SecurityCheck struct {
	ID             string `json:"id"`
	Title          string `json:"title"`
	Status         string `json:"status"`
	Detail         string `json:"detail"`
	Recommendation string `json:"recommendation,omitempty"`
}

type SecurityReport struct {
	Score  int             `json:"score"`
	Checks []SecurityCheck `json:"checks"`
}

func InstallDocker(ctx context.Context) (InstallResult, error) {
	if os.Geteuid() != 0 {
		return InstallResult{}, errors.New("需要 root 权限安装 Docker")
	}
	if path, err := exec.LookPath("docker"); err == nil {
		version, _ := commandOutput(ctx, path, "--version")
		compose, _ := commandOutput(ctx, path, "compose", "version")
		_ = exec.CommandContext(ctx, "systemctl", "enable", "--now", "docker.service").Run()
		return InstallResult{Installed: true, Version: strings.TrimSpace(version), Compose: strings.TrimSpace(compose), Output: "Docker 已安装，已确认服务处于启用状态"}, nil
	}
	id, like := osRelease()
	if id != "debian" && id != "ubuntu" && !strings.Contains(like, "debian") {
		return InstallResult{}, errors.New("快捷安装目前只支持 Debian/Ubuntu；其他发行版请使用官方安装方式")
	}
	ctx, cancel := context.WithTimeout(ctx, 12*time.Minute)
	defer cancel()
	var log bytes.Buffer
	run := func(name string, args ...string) error {
		cmd := exec.CommandContext(ctx, name, args...)
		cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive", "APT_LISTCHANGES_FRONTEND=none")
		cmd.Stdout, cmd.Stderr = &log, &log
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("%s %s: %w", name, strings.Join(args, " "), err)
		}
		return nil
	}
	if err := run("apt-get", "update"); err != nil {
		return InstallResult{Output: tail(log.String(), 24000)}, fmt.Errorf("更新软件源失败: %w", err)
	}
	if err := run("apt-get", "install", "-y", "docker.io"); err != nil {
		return InstallResult{Output: tail(log.String(), 24000)}, fmt.Errorf("安装 docker.io 失败: %w", err)
	}
	for _, candidate := range []string{"docker-compose-v2", "docker-compose-plugin", "docker-compose"} {
		if exec.CommandContext(ctx, "apt-cache", "show", candidate).Run() == nil {
			_ = run("apt-get", "install", "-y", candidate)
			break
		}
	}
	if err := run("systemctl", "enable", "--now", "docker.service"); err != nil {
		return InstallResult{Output: tail(log.String(), 24000)}, fmt.Errorf("启动 Docker 失败: %w", err)
	}
	version, _ := commandOutput(ctx, "docker", "--version")
	compose, _ := commandOutput(ctx, "docker", "compose", "version")
	return InstallResult{Installed: true, Version: strings.TrimSpace(version), Compose: strings.TrimSpace(compose), Output: tail(log.String(), 24000)}, nil
}

func EnableAutomaticUpdates(ctx context.Context) (InstallResult, error) {
	if os.Geteuid() != 0 {
		return InstallResult{}, errors.New("需要 root 权限启用自动安全更新")
	}
	id, like := osRelease()
	if id != "debian" && id != "ubuntu" && !strings.Contains(like, "debian") {
		return InstallResult{}, errors.New("自动安全更新快捷配置目前只支持 Debian/Ubuntu")
	}
	ctx, cancel := context.WithTimeout(ctx, 8*time.Minute)
	defer cancel()
	var log bytes.Buffer
	run := func(name string, args ...string) error {
		cmd := exec.CommandContext(ctx, name, args...)
		cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive")
		cmd.Stdout, cmd.Stderr = &log, &log
		return cmd.Run()
	}
	if err := run("apt-get", "update"); err != nil {
		return InstallResult{Output: tail(log.String(), 24000)}, errors.New("更新软件源失败")
	}
	if err := run("apt-get", "install", "-y", "unattended-upgrades", "apt-listchanges"); err != nil {
		return InstallResult{Output: tail(log.String(), 24000)}, errors.New("安装 unattended-upgrades 失败")
	}
	content := "// Managed by LukePanel\nAPT::Periodic::Update-Package-Lists \"1\";\nAPT::Periodic::Unattended-Upgrade \"1\";\nAPT::Periodic::AutocleanInterval \"7\";\n"
	if err := os.WriteFile("/etc/apt/apt.conf.d/20auto-upgrades", []byte(content), 0o644); err != nil {
		return InstallResult{}, err
	}
	_ = run("systemctl", "enable", "--now", "apt-daily.timer", "apt-daily-upgrade.timer")
	return InstallResult{Installed: true, Output: "已启用 Debian/Ubuntu 自动安全更新；不会自动重启服务器"}, nil
}

func InstallFail2Ban(ctx context.Context, currentIP string) (InstallResult, error) {
	if os.Geteuid() != 0 {
		return InstallResult{}, errors.New("需要 root 权限安装 Fail2ban")
	}
	ctx, cancel := context.WithTimeout(ctx, 8*time.Minute)
	defer cancel()
	var log bytes.Buffer
	run := func(name string, args ...string) error {
		cmd := exec.CommandContext(ctx, name, args...)
		cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive")
		cmd.Stdout, cmd.Stderr = &log, &log
		return cmd.Run()
	}
	if _, err := exec.LookPath("fail2ban-client"); err != nil {
		if err := run("apt-get", "update"); err != nil {
			return InstallResult{Output: tail(log.String(), 24000)}, errors.New("更新软件源失败")
		}
		if err := run("apt-get", "install", "-y", "fail2ban"); err != nil {
			return InstallResult{Output: tail(log.String(), 24000)}, errors.New("安装 Fail2ban 失败")
		}
	}
	ignore := []string{"127.0.0.1/8", "::1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"}
	addIgnoreIP := func(value string) {
		ip := net.ParseIP(strings.Trim(strings.TrimSpace(value), "[]"))
		if ip == nil || ip.IsLoopback() {
			return
		}
		suffix := "/128"
		if ip.To4() != nil {
			suffix = "/32"
		}
		entry := ip.String() + suffix
		for _, existing := range ignore {
			if existing == entry {
				return
			}
		}
		ignore = append(ignore, entry)
	}
	addIgnoreIP(currentIP)
	for _, ip := range activeSSHClientIPs(ctx) {
		addIgnoreIP(ip)
	}
	content := "# Managed by LukePanel\n[sshd]\nenabled = true\nbackend = systemd\nmaxretry = 5\nfindtime = 10m\nbantime = 1h\nignoreip = " + strings.Join(ignore, " ") + "\n"
	path := "/etc/fail2ban/jail.d/lukepanel-sshd.local"
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return InstallResult{}, err
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return InstallResult{}, err
	}
	if output, err := commandOutput(ctx, "fail2ban-client", "-t"); err != nil {
		_ = os.Remove(path)
		return InstallResult{Output: output}, errors.New("Fail2ban 配置校验失败，已撤销")
	}
	if err := run("systemctl", "enable", "--now", "fail2ban.service"); err != nil {
		return InstallResult{Output: tail(log.String(), 24000)}, errors.New("Fail2ban 启动失败")
	}
	if err := run("systemctl", "restart", "fail2ban.service"); err != nil {
		return InstallResult{Output: tail(log.String(), 24000)}, errors.New("Fail2ban 重启失败")
	}
	version, _ := commandOutput(ctx, "fail2ban-client", "--version")
	return InstallResult{Installed: true, Version: strings.TrimSpace(version), Output: "已启用 SSH 防暴力破解；当前访问 IP 和内网地址已加入忽略列表"}, nil
}

func SecurityStatus(ctx context.Context, cfg config.Config, ssh sshadmin.Status) SecurityReport {
	checks := []SecurityCheck{}
	add := func(id, title, status, detail, recommendation string) {
		checks = append(checks, SecurityCheck{ID: id, Title: title, Status: status, Detail: detail, Recommendation: recommendation})
	}
	if strings.HasPrefix(cfg.Listen, "127.0.0.1:") || strings.HasPrefix(cfg.Listen, "[::1]:") || strings.HasPrefix(cfg.Listen, "localhost:") {
		add("panel-listen", "面板仅监听本机", "good", cfg.Listen, "")
	} else {
		add("panel-listen", "面板监听范围", "bad", cfg.Listen, "改为 127.0.0.1 并通过 HTTPS 反向代理访问")
	}
	if cfg.SecureCookie {
		add("secure-cookie", "安全 Cookie", "good", "已强制仅通过 HTTPS 发送", "")
	} else {
		add("secure-cookie", "安全 Cookie", "bad", "当前已关闭", "生产环境必须启用 HTTPS 和 Secure Cookie")
	}
	if cfg.TOTPSecret != "" {
		add("totp", "两步验证", "good", "已开启", "")
	} else {
		add("totp", "两步验证", "warn", "尚未开启", "建议在确认时间同步正常后开启 TOTP")
	}
	if ssh.Available {
		if strings.EqualFold(ssh.PasswordAuthentication, "no") {
			add("ssh-password", "SSH 密码登录", "good", "已关闭", "")
		} else {
			add("ssh-password", "SSH 密码登录", "warn", "仍然开启", "先测试密钥登录，再从 SSH 管理关闭密码登录")
		}
		if strings.EqualFold(ssh.PermitRootLogin, "yes") {
			add("ssh-root", "SSH Root 登录", "warn", "允许 root 使用任意方式登录", "建议至少改为 prohibit-password")
		} else {
			add("ssh-root", "SSH Root 登录", "good", ssh.PermitRootLogin, "")
		}
	} else {
		add("ssh", "OpenSSH", "warn", ssh.Error, "")
	}
	if active(ctx, "fail2ban.service") {
		add("fail2ban", "SSH 防暴力破解", "good", "Fail2ban 正在运行", "")
	} else {
		add("fail2ban", "SSH 防暴力破解", "warn", "Fail2ban 未运行", "可从安全中心一键安装，并自动忽略当前 IP")
	}
	if firewallEnabled(ctx) {
		add("firewall", "主机防火墙", "good", "检测到有效规则", "")
	} else {
		add("firewall", "主机防火墙", "warn", "未检测到明确的入站规则", "配置前先确认 SSH 和面板反代端口，避免锁死")
	}
	if active(ctx, "apt-daily-upgrade.timer") {
		add("auto-updates", "自动安全更新", "good", "apt-daily-upgrade.timer 已启用", "")
	} else {
		add("auto-updates", "自动安全更新", "warn", "未检测到定时安全更新", "建议启用 unattended-upgrades")
	}
	if _, err := os.Stat("/var/run/reboot-required"); err == nil {
		add("reboot", "待重启", "warn", "系统更新后需要重启", "选择业务低峰期重启")
	}
	score := 100
	for _, check := range checks {
		switch check.Status {
		case "bad":
			score -= 20
		case "warn":
			score -= 8
		}
	}
	if score < 0 {
		score = 0
	}
	return SecurityReport{Score: score, Checks: checks}
}

func activeSSHClientIPs(ctx context.Context) []string {
	path, err := exec.LookPath("ss")
	if err != nil {
		return nil
	}
	output, err := commandOutput(ctx, path, "-Htn", "state", "established")
	if err != nil {
		return nil
	}
	seen := map[string]bool{}
	result := []string{}
	for _, line := range strings.Split(output, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		local, remote := fields[len(fields)-2], fields[len(fields)-1]
		_, localPort, err := net.SplitHostPort(local)
		if err != nil || localPort != "22" {
			continue
		}
		host, _, err := net.SplitHostPort(remote)
		if err != nil {
			continue
		}
		host = strings.Trim(host, "[]")
		if net.ParseIP(host) != nil && !seen[host] {
			seen[host] = true
			result = append(result, host)
		}
	}
	return result
}

func active(ctx context.Context, unit string) bool {
	cmd := exec.CommandContext(ctx, "systemctl", "is-active", "--quiet", unit)
	return cmd.Run() == nil
}

func firewallEnabled(ctx context.Context) bool {
	if _, err := exec.LookPath("nft"); err == nil {
		out, _ := commandOutput(ctx, "nft", "list", "ruleset")
		if strings.Contains(out, " hook input ") || strings.Contains(out, "hook input;") {
			return true
		}
	}
	if _, err := exec.LookPath("ufw"); err == nil {
		out, _ := commandOutput(ctx, "ufw", "status")
		return strings.Contains(strings.ToLower(out), "status: active")
	}
	return false
}

func commandOutput(ctx context.Context, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	data, err := cmd.CombinedOutput()
	return tail(string(data), 24000), err
}

func osRelease() (string, string) {
	data, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return "", ""
	}
	values := map[string]string{}
	for _, line := range strings.Split(string(data), "\n") {
		key, value, ok := strings.Cut(line, "=")
		if ok {
			values[key] = strings.Trim(value, "\"'")
		}
	}
	return strings.ToLower(values["ID"]), strings.ToLower(values["ID_LIKE"])
}

func tail(value string, max int) string {
	if len(value) <= max {
		return value
	}
	return "…\n" + value[len(value)-max:]
}
