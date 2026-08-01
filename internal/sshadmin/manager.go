package sshadmin

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Status struct {
	Available              bool   `json:"available"`
	Service                string `json:"service,omitempty"`
	Port                   string `json:"port,omitempty"`
	PermitRootLogin        string `json:"permit_root_login,omitempty"`
	PasswordAuthentication string `json:"password_authentication,omitempty"`
	PubkeyAuthentication   string `json:"pubkey_authentication,omitempty"`
	AllowTcpForwarding     string `json:"allow_tcp_forwarding,omitempty"`
	AllowAgentForwarding   string `json:"allow_agent_forwarding,omitempty"`
	X11Forwarding          string `json:"x11_forwarding,omitempty"`
	PendingOldPort         string `json:"pending_old_port,omitempty"`
	PendingNewPort         string `json:"pending_new_port,omitempty"`
	Error                  string `json:"error,omitempty"`
}

type User struct {
	Name     string `json:"name"`
	UID      int    `json:"uid"`
	GID      int    `json:"gid"`
	Home     string `json:"home"`
	Shell    string `json:"shell"`
	KeyCount int    `json:"key_count"`
	Sudo     bool   `json:"sudo"`
}

type Key struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Fingerprint string `json:"fingerprint"`
	Comment     string `json:"comment"`
	Preview     string `json:"preview"`
}

type GeneratedKey struct {
	Filename    string `json:"filename"`
	PrivateKey  string `json:"private_key"`
	PublicKey   string `json:"public_key"`
	Fingerprint string `json:"fingerprint"`
	Comment     string `json:"comment"`
}

type Manager struct{ dataDir string }

func New(dataDir string) *Manager { return &Manager{dataDir: dataDir} }

func (m *Manager) Status(ctx context.Context) Status {
	path, err := exec.LookPath("sshd")
	if err != nil {
		return Status{Available: false, Error: "未安装 OpenSSH Server"}
	}
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, path, "-T")
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return Status{Available: false, Error: message}
	}
	values := map[string]string{}
	scanner := bufio.NewScanner(&stdout)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) >= 2 {
			values[strings.ToLower(fields[0])] = strings.Join(fields[1:], " ")
		}
	}
	status := Status{
		Available:              true,
		Service:                detectService(ctx),
		Port:                   values["port"],
		PermitRootLogin:        values["permitrootlogin"],
		PasswordAuthentication: values["passwordauthentication"],
		PubkeyAuthentication:   values["pubkeyauthentication"],
		AllowTcpForwarding:     values["allowtcpforwarding"],
		AllowAgentForwarding:   values["allowagentforwarding"],
		X11Forwarding:          values["x11forwarding"],
	}
	if pending, err := m.loadPendingPort(); err == nil {
		status.PendingOldPort = pending.OldPort
		status.PendingNewPort = pending.NewPort
	}
	return status
}

func (m *Manager) Users() ([]User, error) {
	data, err := os.ReadFile("/etc/passwd")
	if err != nil {
		return nil, err
	}
	users := []User{}
	for _, line := range strings.Split(string(data), "\n") {
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Split(line, ":")
		if len(fields) < 7 {
			continue
		}
		uid, err1 := strconv.Atoi(fields[2])
		gid, err2 := strconv.Atoi(fields[3])
		if err1 != nil || err2 != nil || (uid != 0 && uid < 1000) {
			continue
		}
		shell := fields[6]
		if strings.HasSuffix(shell, "/nologin") || strings.HasSuffix(shell, "/false") {
			continue
		}
		home := filepath.Clean(fields[5])
		if !filepath.IsAbs(home) {
			continue
		}
		keys, _ := readKeys(filepath.Join(home, ".ssh", "authorized_keys"))
		users = append(users, User{Name: fields[0], UID: uid, GID: gid, Home: home, Shell: shell, KeyCount: len(keys), Sudo: userInAdminGroup(fields[0])})
	}
	sort.Slice(users, func(i, j int) bool {
		if users[i].UID == 0 {
			return true
		}
		if users[j].UID == 0 {
			return false
		}
		return users[i].Name < users[j].Name
	})
	return users, nil
}

func (m *Manager) Keys(username string) ([]Key, error) {
	user, err := m.lookupUser(username)
	if err != nil {
		return nil, err
	}
	lines, err := readKeys(filepath.Join(user.Home, ".ssh", "authorized_keys"))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	out := make([]Key, 0, len(lines))
	for _, line := range lines {
		key, err := parseKey(line)
		if err == nil {
			out = append(out, key)
		}
	}
	return out, nil
}

func (m *Manager) AddKey(username, value string) (Key, error) {
	user, err := m.lookupUser(username)
	if err != nil {
		return Key{}, err
	}
	line := strings.TrimSpace(value)
	key, err := parseKey(line)
	if err != nil {
		return Key{}, err
	}
	dir := filepath.Join(user.Home, ".ssh")
	path := filepath.Join(dir, "authorized_keys")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return Key{}, err
	}
	_ = os.Chown(dir, user.UID, user.GID)
	lines, err := readKeys(path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return Key{}, err
	}
	for _, existing := range lines {
		parsed, err := parseKey(existing)
		if err == nil && parsed.ID == key.ID {
			return Key{}, errors.New("这把公钥已经存在")
		}
	}
	lines = append(lines, line)
	if err := m.writeKeys(path, lines, user); err != nil {
		return Key{}, err
	}
	return key, nil
}

func (m *Manager) DeleteKey(username, id string) error {
	user, err := m.lookupUser(username)
	if err != nil {
		return err
	}
	path := filepath.Join(user.Home, ".ssh", "authorized_keys")
	lines, err := readKeys(path)
	if err != nil {
		return err
	}
	kept := make([]string, 0, len(lines))
	found := false
	for _, line := range lines {
		key, err := parseKey(line)
		if err == nil && key.ID == id {
			found = true
			continue
		}
		kept = append(kept, line)
	}
	if !found {
		return errors.New("未找到这把公钥")
	}
	return m.writeKeys(path, kept, user)
}

func (m *Manager) SetPasswordAuthentication(ctx context.Context, enabled bool) error {
	if os.Geteuid() != 0 {
		return errors.New("需要 root 权限修改 SSH 配置")
	}
	if _, err := exec.LookPath("sshd"); err != nil {
		return errors.New("未安装 OpenSSH Server")
	}
	if !enabled {
		users, err := m.Users()
		if err != nil {
			return err
		}
		totalKeys := 0
		for _, user := range users {
			totalKeys += user.KeyCount
		}
		if totalKeys == 0 {
			return errors.New("至少先添加并测试一把 SSH 公钥，才能关闭密码登录")
		}
		status := m.Status(ctx)
		if !status.Available || strings.ToLower(status.PubkeyAuthentication) != "yes" {
			return errors.New("SSH 公钥登录尚未启用，不能关闭密码登录")
		}
	}
	const path = "/etc/ssh/sshd_config.d/90-lukepanel-hardening.conf"
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	old, oldErr := os.ReadFile(path)
	value := "no"
	interactive := "no"
	if enabled {
		value = "yes"
		interactive = "yes"
	}
	content := []byte("# Managed by LukePanel. Edit from the panel or remove this file.\n" +
		"PasswordAuthentication " + value + "\n" +
		"KbdInteractiveAuthentication " + interactive + "\n" +
		"ChallengeResponseAuthentication " + interactive + "\n")
	backupDir := filepath.Join(m.dataDir, "backups", "ssh")
	_ = os.MkdirAll(backupDir, 0o700)
	if oldErr == nil {
		_ = os.WriteFile(filepath.Join(backupDir, time.Now().UTC().Format("20060102T150405.000000000")+"-sshd-hardening.conf.bak"), old, 0o600)
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".lukepanel-sshd-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0o644); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(content); err != nil {
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
	if err := os.Rename(tmpName, path); err != nil {
		return err
	}
	rollback := func() {
		if oldErr == nil {
			_ = os.WriteFile(path, old, 0o644)
		} else {
			_ = os.Remove(path)
		}
	}
	reloadOldConfig := func(service string) string {
		rollback()
		rollbackCtx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
		defer cancel()
		if output, err := exec.CommandContext(rollbackCtx, "sshd", "-t").CombinedOutput(); err != nil {
			return "；恢复后的 SSH 配置校验失败，请保持当前连接并立即检查：" + strings.TrimSpace(string(output))
		}
		if service != "" {
			if output, err := exec.CommandContext(rollbackCtx, "systemctl", "reload", service).CombinedOutput(); err != nil {
				return "；旧配置已写回，但重新加载失败，请保持当前连接并立即检查：" + strings.TrimSpace(string(output))
			}
		}
		return ""
	}
	sshd, _ := exec.LookPath("sshd")
	test := exec.CommandContext(ctx, sshd, "-t")
	if output, err := test.CombinedOutput(); err != nil {
		note := reloadOldConfig("")
		return fmt.Errorf("SSH 配置校验失败，已自动恢复: %s%s", strings.TrimSpace(string(output)), note)
	}
	service := detectService(ctx)
	if service == "" {
		reloadOldConfig("")
		return errors.New("未找到 SSH systemd 服务，配置已自动恢复")
	}
	reload := exec.CommandContext(ctx, "systemctl", "reload", service)
	if output, err := reload.CombinedOutput(); err != nil {
		note := reloadOldConfig(service)
		return fmt.Errorf("SSH 重载失败，配置已自动恢复: %s%s", strings.TrimSpace(string(output)), note)
	}

	// Do not trust a successful reload alone. Some distributions do not include
	// sshd_config.d by default, in which case the drop-in exists but has no effect.
	status := m.Status(ctx)
	expected := strings.ToLower(value)
	if !status.Available || strings.ToLower(status.PasswordAuthentication) != expected {
		note := reloadOldConfig(service)
		actual := status.PasswordAuthentication
		if actual == "" {
			actual = "无法读取"
		}
		return fmt.Errorf("SSH 返回的实际 PasswordAuthentication=%s，目标值=%s；系统可能没有加载 sshd_config.d，已自动恢复%s", actual, expected, note)
	}
	_ = pruneBackups(backupDir, 100)
	return nil
}

func (m *Manager) GenerateKey(ctx context.Context, username, comment, passphrase string) (GeneratedKey, error) {
	if os.Geteuid() != 0 {
		return GeneratedKey{}, errors.New("需要 root 权限生成 SSH 密钥")
	}
	if _, err := exec.LookPath("ssh-keygen"); err != nil {
		return GeneratedKey{}, errors.New("未找到 ssh-keygen")
	}
	if _, err := m.lookupUser(username); err != nil {
		return GeneratedKey{}, err
	}
	comment = strings.TrimSpace(comment)
	if comment == "" {
		comment = "lukepanel-" + username + "-" + time.Now().Format("20060102")
	}
	if len(comment) > 120 || strings.ContainsAny(comment, "\r\n\x00") {
		return GeneratedKey{}, errors.New("密钥备注过长或包含非法字符")
	}
	if len(passphrase) > 256 || strings.ContainsRune(passphrase, '\x00') {
		return GeneratedKey{}, errors.New("私钥口令过长或包含非法字符")
	}
	dir, err := os.MkdirTemp("", "lukepanel-key-*")
	if err != nil {
		return GeneratedKey{}, err
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "id_ed25519")
	cmd := exec.CommandContext(ctx, "ssh-keygen", "-q", "-t", "ed25519", "-a", "100", "-N", passphrase, "-C", comment, "-f", path)
	if output, err := cmd.CombinedOutput(); err != nil {
		return GeneratedKey{}, fmt.Errorf("生成密钥失败: %s", strings.TrimSpace(string(output)))
	}
	privateKey, err := os.ReadFile(path)
	if err != nil {
		return GeneratedKey{}, err
	}
	publicKey, err := os.ReadFile(path + ".pub")
	if err != nil {
		return GeneratedKey{}, err
	}
	key, err := m.AddKey(username, string(publicKey))
	if err != nil {
		return GeneratedKey{}, err
	}
	filename := fmt.Sprintf("%s-lukepanel-%s-ed25519", username, time.Now().Format("20060102-150405"))
	return GeneratedKey{Filename: filename, PrivateKey: string(privateKey), PublicKey: strings.TrimSpace(string(publicKey)), Fingerprint: key.Fingerprint, Comment: key.Comment}, nil
}

func (m *Manager) writeKeys(path string, lines []string, user User) error {
	if data, err := os.ReadFile(path); err == nil && len(data) > 0 {
		backupDir := filepath.Join(m.dataDir, "backups", "ssh")
		if err := os.MkdirAll(backupDir, 0o700); err == nil {
			name := fmt.Sprintf("%s-%s-authorized_keys.bak", time.Now().UTC().Format("20060102T150405.000000000"), user.Name)
			_ = os.WriteFile(filepath.Join(backupDir, name), data, 0o600)
			_ = pruneBackups(backupDir, 100)
		}
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".authorized_keys-*.tmp")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return err
	}
	content := ""
	if len(lines) > 0 {
		content = strings.Join(lines, "\n") + "\n"
	}
	if _, err := tmp.WriteString(content); err != nil {
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
	if err := os.Chown(name, user.UID, user.GID); err != nil {
		return err
	}
	return os.Rename(name, path)
}

func pruneBackups(dir string, maxFiles int) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	type backup struct {
		path string
		at   time.Time
	}
	items := make([]backup, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err == nil {
			items = append(items, backup{path: filepath.Join(dir, entry.Name()), at: info.ModTime()})
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].at.Before(items[j].at) })
	for len(items) > maxFiles {
		_ = os.Remove(items[0].path)
		items = items[1:]
	}
	return nil
}

func (m *Manager) lookupUser(username string) (User, error) {
	if username == "" || strings.ContainsAny(username, "/\\:\x00\r\n") {
		return User{}, errors.New("invalid username")
	}
	users, err := m.Users()
	if err != nil {
		return User{}, err
	}
	for _, user := range users {
		if user.Name == username {
			return user, nil
		}
	}
	return User{}, errors.New("用户不存在或不允许登录")
}

func readKeys(path string) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	lines := []string{}
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 4096), 1<<20)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" && !strings.HasPrefix(line, "#") {
			lines = append(lines, line)
		}
	}
	return lines, scanner.Err()
}

func parseKey(line string) (Key, error) {
	fields := strings.Fields(strings.TrimSpace(line))
	if len(fields) < 2 {
		return Key{}, errors.New("公钥格式不完整")
	}
	allowed := map[string]bool{"ssh-ed25519": true, "ssh-rsa": true, "ecdsa-sha2-nistp256": true, "ecdsa-sha2-nistp384": true, "ecdsa-sha2-nistp521": true, "sk-ssh-ed25519@openssh.com": true, "sk-ecdsa-sha2-nistp256@openssh.com": true}
	keyIndex := -1
	for i, field := range fields {
		if allowed[field] {
			keyIndex = i
			break
		}
	}
	if keyIndex < 0 || keyIndex+1 >= len(fields) {
		return Key{}, errors.New("暂不支持这种公钥类型")
	}
	blob, err := base64.StdEncoding.DecodeString(fields[keyIndex+1])
	if err != nil || len(blob) < 16 {
		return Key{}, errors.New("公钥内容无效")
	}
	sum := sha256.Sum256(blob)
	fingerprint := "SHA256:" + base64.RawStdEncoding.EncodeToString(sum[:])
	comment := ""
	if len(fields) > keyIndex+2 {
		comment = strings.Join(fields[keyIndex+2:], " ")
	}
	preview := fields[keyIndex+1]
	if len(preview) > 18 {
		preview = preview[:10] + "…" + preview[len(preview)-7:]
	}
	return Key{ID: base64.RawURLEncoding.EncodeToString(sum[:12]), Type: fields[keyIndex], Fingerprint: fingerprint, Comment: comment, Preview: preview}, nil
}

func detectService(ctx context.Context) string {
	for _, name := range []string{"ssh.service", "sshd.service"} {
		cmd := exec.CommandContext(ctx, "systemctl", "show", name, "--property=LoadState", "--value")
		if out, err := cmd.Output(); err == nil && strings.TrimSpace(string(out)) == "loaded" {
			return name
		}
	}
	return ""
}

type SettingsRequest struct {
	Port                 int    `json:"port"`
	PermitRootLogin      string `json:"permit_root_login"`
	AllowTcpForwarding   bool   `json:"allow_tcp_forwarding"`
	AllowAgentForwarding bool   `json:"allow_agent_forwarding"`
	X11Forwarding        bool   `json:"x11_forwarding"`
}

type SettingsResult struct {
	PendingPortConfirmation bool   `json:"pending_port_confirmation"`
	OldPort                 string `json:"old_port,omitempty"`
	NewPort                 string `json:"new_port,omitempty"`
	Message                 string `json:"message"`
}

type pendingPort struct {
	OldPort   string    `json:"old_port"`
	NewPort   string    `json:"new_port"`
	CreatedAt time.Time `json:"created_at"`
}

func (m *Manager) ApplySettings(ctx context.Context, request SettingsRequest) (SettingsResult, error) {
	if os.Geteuid() != 0 {
		return SettingsResult{}, errors.New("需要 root 权限修改 SSH 配置")
	}
	if request.Port < 1 || request.Port > 65535 {
		return SettingsResult{}, errors.New("SSH 端口必须是 1-65535")
	}
	root := strings.ToLower(strings.TrimSpace(request.PermitRootLogin))
	allowedRoot := map[string]bool{"yes": true, "prohibit-password": true, "forced-commands-only": true, "no": true}
	if !allowedRoot[root] {
		return SettingsResult{}, errors.New("Root 登录策略无效")
	}
	status := m.Status(ctx)
	if !status.Available {
		return SettingsResult{}, errors.New(status.Error)
	}
	oldPort := strings.Fields(status.Port)
	currentPort := "22"
	if len(oldPort) > 0 {
		currentPort = oldPort[0]
	}
	newPort := strconv.Itoa(request.Port)
	lines := []string{"# Managed by LukePanel. Changes are validated before reload."}
	if newPort != currentPort {
		// Keep the previous port until the user confirms the new port works.
		lines = append(lines, "Port "+currentPort, "Port "+newPort)
	} else {
		lines = append(lines, "Port "+newPort)
	}
	lines = append(lines,
		"PermitRootLogin "+root,
		"AllowTcpForwarding "+yesNo(request.AllowTcpForwarding),
		"AllowAgentForwarding "+yesNo(request.AllowAgentForwarding),
		"X11Forwarding "+yesNo(request.X11Forwarding),
	)
	const path = "/etc/ssh/sshd_config.d/91-lukepanel-settings.conf"
	old, oldErr := os.ReadFile(path)
	if err := m.writeAndReload(ctx, path, []byte(strings.Join(lines, "\n")+"\n"), old, oldErr); err != nil {
		return SettingsResult{}, err
	}
	if newPort != currentPort {
		pending := pendingPort{OldPort: currentPort, NewPort: newPort, CreatedAt: time.Now().UTC()}
		if err := m.savePendingPort(pending); err != nil {
			return SettingsResult{}, err
		}
		if !listeningPort(ctx, newPort) {
			_ = m.restoreConfig(ctx, path, old, oldErr)
			_ = os.Remove(m.pendingPortPath())
			return SettingsResult{}, errors.New("SSH 重载后没有监听新端口，已自动恢复旧配置")
		}
		return SettingsResult{PendingPortConfirmation: true, OldPort: currentPort, NewPort: newPort, Message: "新旧端口会暂时同时监听。请从另一个终端测试新端口，成功后再确认切换。"}, nil
	}
	_ = os.Remove(m.pendingPortPath())
	return SettingsResult{Message: "SSH 高级设置已生效"}, nil
}

func (m *Manager) ConfirmPort(ctx context.Context, keepNew bool) (SettingsResult, error) {
	pending, err := m.loadPendingPort()
	if err != nil {
		return SettingsResult{}, errors.New("没有等待确认的 SSH 端口变更")
	}
	const path = "/etc/ssh/sshd_config.d/91-lukepanel-settings.conf"
	content, err := os.ReadFile(path)
	if err != nil {
		return SettingsResult{}, err
	}
	lines := []string{}
	for _, line := range strings.Split(string(content), "\n") {
		trimmed := strings.TrimSpace(line)
		if keepNew && trimmed == "Port "+pending.OldPort {
			continue
		}
		if !keepNew && trimmed == "Port "+pending.NewPort {
			continue
		}
		if trimmed != "" {
			lines = append(lines, line)
		}
	}
	old := append([]byte(nil), content...)
	if err := m.writeAndReload(ctx, path, []byte(strings.Join(lines, "\n")+"\n"), old, nil); err != nil {
		return SettingsResult{}, err
	}
	_ = os.Remove(m.pendingPortPath())
	if keepNew {
		return SettingsResult{NewPort: pending.NewPort, Message: "已确认新 SSH 端口，旧端口已停止监听"}, nil
	}
	return SettingsResult{OldPort: pending.OldPort, Message: "已取消端口切换，继续使用旧端口"}, nil
}

func (m *Manager) writeAndReload(ctx context.Context, path string, content, old []byte, oldErr error) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	backupDir := filepath.Join(m.dataDir, "backups", "ssh")
	_ = os.MkdirAll(backupDir, 0o700)
	if oldErr == nil {
		_ = os.WriteFile(filepath.Join(backupDir, time.Now().UTC().Format("20060102T150405.000000000")+"-sshd-settings.conf.bak"), old, 0o600)
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".lukepanel-sshd-settings-*.tmp")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if err := tmp.Chmod(0o644); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(content); err != nil {
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
	if err := os.Rename(name, path); err != nil {
		return err
	}
	if output, err := exec.CommandContext(ctx, "sshd", "-t").CombinedOutput(); err != nil {
		_ = m.restoreConfig(ctx, path, old, oldErr)
		return fmt.Errorf("SSH 配置校验失败，已自动恢复: %s", strings.TrimSpace(string(output)))
	}
	service := detectService(ctx)
	if service == "" {
		_ = m.restoreConfig(ctx, path, old, oldErr)
		return errors.New("未找到 SSH 服务，已自动恢复")
	}
	if output, err := exec.CommandContext(ctx, "systemctl", "reload", service).CombinedOutput(); err != nil {
		_ = m.restoreConfig(ctx, path, old, oldErr)
		return fmt.Errorf("SSH 重载失败，已自动恢复: %s", strings.TrimSpace(string(output)))
	}
	_ = pruneBackups(backupDir, 100)
	return nil
}

func (m *Manager) restoreConfig(ctx context.Context, path string, old []byte, oldErr error) error {
	if oldErr == nil {
		_ = os.WriteFile(path, old, 0o644)
	} else {
		_ = os.Remove(path)
	}
	if output, err := exec.CommandContext(ctx, "sshd", "-t").CombinedOutput(); err != nil {
		return fmt.Errorf("恢复后校验失败: %s", strings.TrimSpace(string(output)))
	}
	if service := detectService(ctx); service != "" {
		_, _ = exec.CommandContext(ctx, "systemctl", "reload", service).CombinedOutput()
	}
	return nil
}

func (m *Manager) pendingPortPath() string { return filepath.Join(m.dataDir, "ssh-pending-port.json") }
func (m *Manager) savePendingPort(value pendingPort) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return os.WriteFile(m.pendingPortPath(), data, 0o600)
}
func (m *Manager) loadPendingPort() (pendingPort, error) {
	var value pendingPort
	data, err := os.ReadFile(m.pendingPortPath())
	if err != nil {
		return value, err
	}
	err = json.Unmarshal(data, &value)
	return value, err
}
func yesNo(value bool) string {
	if value {
		return "yes"
	}
	return "no"
}
func listeningPort(ctx context.Context, port string) bool {
	output, err := exec.CommandContext(ctx, "ss", "-lntH").Output()
	if err != nil {
		return false
	}
	for _, line := range strings.Split(string(output), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		if strings.HasSuffix(strings.Trim(fields[3], "[]"), ":"+port) {
			return true
		}
	}
	return false
}

func userInAdminGroup(name string) bool {
	if out, err := exec.Command("id", "-nG", name).Output(); err == nil {
		for _, item := range strings.Fields(string(out)) {
			if item == "sudo" || item == "wheel" {
				return true
			}
		}
	}
	return false
}

var managedUserPattern = regexp.MustCompile(`^[a-z_][a-z0-9_-]{0,31}$`)

func (m *Manager) CreateUser(ctx context.Context, name string, sudo bool) (User, error) {
	name = strings.TrimSpace(name)
	if !managedUserPattern.MatchString(name) || name == "root" || name == "lukepanel" {
		return User{}, errors.New("用户名只能使用小写字母、数字、下划线和短横线")
	}
	if _, err := user.Lookup(name); err == nil {
		return User{}, errors.New("系统用户已经存在")
	}
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "useradd", "--create-home", "--shell", "/bin/bash", name).CombinedOutput()
	if err != nil {
		return User{}, fmt.Errorf("创建用户失败：%s", strings.TrimSpace(string(out)))
	}
	rollback := true
	defer func() {
		if rollback {
			_ = exec.Command("userdel", "--remove", name).Run()
		}
	}()
	_ = exec.CommandContext(ctx, "passwd", "--lock", name).Run()
	if sudo {
		if err := setUserSudo(ctx, name, true); err != nil {
			return User{}, err
		}
	}
	users, err := m.Users()
	if err != nil {
		return User{}, err
	}
	for _, item := range users {
		if item.Name == name {
			rollback = false
			return item, nil
		}
	}
	return User{}, errors.New("用户已创建但无法重新读取")
}

func (m *Manager) DeleteUser(ctx context.Context, name string, removeHome bool) error {
	name = strings.TrimSpace(name)
	if !managedUserPattern.MatchString(name) || name == "root" || name == "lukepanel" {
		return errors.New("不能删除受保护用户")
	}
	u, err := user.Lookup(name)
	if err != nil {
		return errors.New("系统用户不存在")
	}
	uid, _ := strconv.Atoi(u.Uid)
	if uid < 1000 {
		return errors.New("不能通过面板删除系统服务用户")
	}
	if out, _ := exec.CommandContext(ctx, "pgrep", "-u", name).Output(); len(bytes.TrimSpace(out)) > 0 {
		return errors.New("这个用户仍有运行中的进程，请先退出会话并停止进程")
	}
	args := []string{}
	if removeHome {
		args = append(args, "--remove")
	}
	args = append(args, name)
	out, err := exec.CommandContext(ctx, "userdel", args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("删除用户失败：%s", strings.TrimSpace(string(out)))
	}
	return nil
}

func (m *Manager) SetSudo(ctx context.Context, name string, enabled bool) error {
	name = strings.TrimSpace(name)
	if !managedUserPattern.MatchString(name) || name == "root" || name == "lukepanel" {
		return errors.New("用户名称无效")
	}
	if _, err := user.Lookup(name); err != nil {
		return errors.New("系统用户不存在")
	}
	return setUserSudo(ctx, name, enabled)
}
func setUserSudo(ctx context.Context, name string, enabled bool) error {
	group := "sudo"
	if _, err := user.LookupGroup(group); err != nil {
		group = "wheel"
		if _, err = user.LookupGroup(group); err != nil {
			return errors.New("系统没有 sudo 或 wheel 用户组")
		}
	}
	var cmd *exec.Cmd
	if enabled {
		cmd = exec.CommandContext(ctx, "usermod", "-aG", group, name)
	} else {
		cmd = exec.CommandContext(ctx, "gpasswd", "-d", name, group)
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("修改 sudo 权限失败：%s", strings.TrimSpace(string(out)))
	}
	return nil
}
