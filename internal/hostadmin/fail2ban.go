package hostadmin

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"time"
)

const lukePanelFail2BanConfig = "/etc/fail2ban/jail.d/lukepanel-sshd.local"

type Fail2BanInfo struct {
	Installed       bool     `json:"installed"`
	Active          bool     `json:"active"`
	Jail            string   `json:"jail"`
	CurrentlyFailed int      `json:"currently_failed"`
	TotalFailed     int      `json:"total_failed"`
	CurrentlyBanned int      `json:"currently_banned"`
	TotalBanned     int      `json:"total_banned"`
	BannedIPs       []string `json:"banned_ips"`
	IgnoreIPs       []string `json:"ignore_ips"`
	Error           string   `json:"error,omitempty"`
}

func Fail2BanStatus(ctx context.Context) Fail2BanInfo {
	info := Fail2BanInfo{Jail: "sshd"}
	if _, err := exec.LookPath("fail2ban-client"); err != nil {
		return info
	}
	info.Installed = true
	info.Active = active(ctx, "fail2ban.service")
	if !info.Active {
		return info
	}
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	output, err := commandOutput(ctx, "fail2ban-client", "status", "sshd")
	if err != nil {
		info.Error = strings.TrimSpace(output)
		return info
	}
	parseFail2BanStatusOutput(output, &info)
	if data, err := os.ReadFile(lukePanelFail2BanConfig); err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(strings.TrimSpace(line), "ignoreip") {
				_, values, _ := strings.Cut(line, "=")
				info.IgnoreIPs = cleanIPEntries(strings.Fields(values))
				break
			}
		}
	}
	return info
}

func parseFail2BanStatusOutput(output string, info *Fail2BanInfo) {
	for _, raw := range strings.Split(output, "\n") {
		line := strings.TrimSpace(raw)
		line = strings.TrimLeft(line, "|`-+ \t")
		if strings.Contains(line, "Banned IP list:") {
			_, values, _ := strings.Cut(line, "Banned IP list:")
			info.BannedIPs = cleanIPEntries(strings.Fields(values))
			continue
		}
		label, valueText, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		value, err := strconv.Atoi(strings.TrimSpace(valueText))
		if err != nil {
			continue
		}
		switch strings.TrimSpace(label) {
		case "Currently failed":
			info.CurrentlyFailed = value
		case "Total failed":
			info.TotalFailed = value
		case "Currently banned":
			info.CurrentlyBanned = value
		case "Total banned":
			info.TotalBanned = value
		}
	}
}

func Fail2BanUnban(ctx context.Context, ip string) error {
	parsed := net.ParseIP(strings.TrimSpace(ip))
	if parsed == nil {
		return errors.New("解封地址必须是有效 IP")
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	output, err := commandOutput(ctx, "fail2ban-client", "set", "sshd", "unbanip", parsed.String())
	if err != nil {
		return fmt.Errorf("Fail2ban 解封失败: %s", strings.TrimSpace(output))
	}
	return nil
}

func UpdateFail2BanIgnore(ctx context.Context, entry, action, protectedIP string) (Fail2BanInfo, error) {
	entry, err := normalizeIPOrCIDR(entry)
	if err != nil {
		return Fail2BanInfo{}, err
	}
	if action != "add" && action != "remove" {
		return Fail2BanInfo{}, errors.New("不支持的白名单操作")
	}
	if action == "remove" && ipEntryContains(entry, protectedIP) {
		return Fail2BanInfo{}, errors.New("不能移除当前访问 IP；请先从另一个受信任网络登录")
	}
	original, err := os.ReadFile(lukePanelFail2BanConfig)
	if err != nil {
		return Fail2BanInfo{}, errors.New("请先从安全中心安装并启用 Fail2ban")
	}
	lines := strings.Split(string(original), "\n")
	found := false
	entries := []string{}
	for _, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), "ignoreip") {
			_, values, _ := strings.Cut(line, "=")
			entries = cleanIPEntries(strings.Fields(values))
			found = true
			break
		}
	}
	if !found {
		return Fail2BanInfo{}, errors.New("LukePanel Fail2ban 配置缺少 ignoreip")
	}
	set := map[string]bool{}
	for _, item := range entries {
		set[item] = true
	}
	if action == "add" {
		set[entry] = true
	} else {
		delete(set, entry)
	}
	// Never remove the local and RFC1918 safety baseline created by LukePanel.
	for _, required := range []string{"127.0.0.1/8", "::1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"} {
		set[required] = true
	}
	entries = entries[:0]
	for item := range set {
		entries = append(entries, item)
	}
	sort.Strings(entries)
	for i, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), "ignoreip") {
			lines[i] = "ignoreip = " + strings.Join(entries, " ")
			break
		}
	}
	if err := os.WriteFile(lukePanelFail2BanConfig, []byte(strings.Join(lines, "\n")), 0o644); err != nil {
		return Fail2BanInfo{}, err
	}
	rollback := func() { _ = os.WriteFile(lukePanelFail2BanConfig, original, 0o644) }
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	if output, err := commandOutput(ctx, "fail2ban-client", "-t"); err != nil {
		rollback()
		return Fail2BanInfo{}, fmt.Errorf("Fail2ban 配置校验失败，已恢复: %s", strings.TrimSpace(output))
	}
	if output, err := commandOutput(ctx, "systemctl", "restart", "fail2ban.service"); err != nil {
		rollback()
		_ = exec.CommandContext(ctx, "systemctl", "restart", "fail2ban.service").Run()
		return Fail2BanInfo{}, fmt.Errorf("Fail2ban 重启失败，已恢复: %s", strings.TrimSpace(output))
	}
	return Fail2BanStatus(ctx), nil
}

func normalizeIPOrCIDR(value string) (string, error) {
	value = strings.TrimSpace(value)
	if ip := net.ParseIP(value); ip != nil {
		return ip.String(), nil
	}
	_, network, err := net.ParseCIDR(value)
	if err != nil {
		return "", errors.New("请输入有效 IP 或 CIDR")
	}
	return network.String(), nil
}

func cleanIPEntries(values []string) []string {
	seen := map[string]bool{}
	items := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		items = append(items, value)
	}
	sort.Strings(items)
	return items
}

func ipEntryContains(entry, ipValue string) bool {
	ip := net.ParseIP(strings.Trim(strings.TrimSpace(ipValue), "[]"))
	if ip == nil {
		return false
	}
	if parsed := net.ParseIP(entry); parsed != nil {
		return parsed.Equal(ip)
	}
	_, network, err := net.ParseCIDR(entry)
	return err == nil && network.Contains(ip)
}
