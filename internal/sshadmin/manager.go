package sshadmin

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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
	Error                  string `json:"error,omitempty"`
}

type User struct {
	Name     string `json:"name"`
	UID      int    `json:"uid"`
	GID      int    `json:"gid"`
	Home     string `json:"home"`
	Shell    string `json:"shell"`
	KeyCount int    `json:"key_count"`
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
	return Status{
		Available:              true,
		Service:                detectService(ctx),
		Port:                   values["port"],
		PermitRootLogin:        values["permitrootlogin"],
		PasswordAuthentication: values["passwordauthentication"],
		PubkeyAuthentication:   values["pubkeyauthentication"],
	}
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
		users = append(users, User{Name: fields[0], UID: uid, GID: gid, Home: home, Shell: shell, KeyCount: len(keys)})
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
