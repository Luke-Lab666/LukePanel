package server

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/config"
)

const trustedDeviceCookie = "lukepanel_trusted_device"

var telegramTokenPattern = regexp.MustCompile(`^[0-9]{5,16}:[A-Za-z0-9_-]{20,100}$`)
var telegramChatPattern = regexp.MustCompile(`^-?[0-9]{4,24}$`)

func (s *Server) trustedDeviceValid(r *http.Request) bool {
	cookie, err := r.Cookie(trustedDeviceCookie)
	if err != nil || cookie.Value == "" {
		return false
	}
	hash := hashToken(cookie.Value)
	now := time.Now().UTC()
	ip := clientIP(r, s.cfg.TrustedProxy)
	s.configMu.Lock()
	defer s.configMu.Unlock()
	updated := s.cfg
	found := false
	for i := range updated.TrustedDevices {
		if subtleStringEqual(updated.TrustedDevices[i].TokenHash, hash) {
			updated.TrustedDevices[i].LastUsed = now
			updated.TrustedDevices[i].LastIP = ip
			found = true
			break
		}
	}
	if found {
		_ = config.Save(s.configPath, updated)
		s.cfg = updated
	}
	return found
}

func (s *Server) createTrustedDevice(w http.ResponseWriter, r *http.Request, name string) error {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	name = strings.TrimSpace(name)
	if name == "" {
		name = deviceName(r.UserAgent())
	}
	if len(name) > 80 {
		name = name[:80]
	}
	record := config.TrustedDevice{ID: hashToken(token)[:16], Name: name, TokenHash: hashToken(token), CreatedAt: time.Now().UTC(), LastUsed: time.Now().UTC(), LastIP: clientIP(r, s.cfg.TrustedProxy)}
	s.configMu.Lock()
	updated := s.cfg
	if len(updated.TrustedDevices) >= 12 {
		sort.Slice(updated.TrustedDevices, func(i, j int) bool {
			return updated.TrustedDevices[i].LastUsed.After(updated.TrustedDevices[j].LastUsed)
		})
		updated.TrustedDevices = updated.TrustedDevices[:11]
	}
	updated.TrustedDevices = append(updated.TrustedDevices, record)
	err := config.Save(s.configPath, updated)
	if err == nil {
		s.cfg = updated
	}
	s.configMu.Unlock()
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{Name: trustedDeviceCookie, Value: token, Path: "/", HttpOnly: true, Secure: s.cfg.SecureCookie, SameSite: http.SameSiteStrictMode, MaxAge: 30 * 86400})
	return nil
}

func (s *Server) trustedDeviceManagement(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.configMu.RLock()
		items := append([]config.TrustedDevice{}, s.cfg.TrustedDevices...)
		s.configMu.RUnlock()
		for i := range items {
			items[i].TokenHash = ""
		}
		sort.Slice(items, func(i, j int) bool { return items[i].LastUsed.After(items[j].LastUsed) })
		writeJSON(w, 200, map[string]any{"devices": items})
	case http.MethodDelete:
		if !s.requireElevation(w, r) {
			return
		}
		var req struct {
			ID  string `json:"id"`
			All bool   `json:"all"`
		}
		if decodeJSON(w, r, 4096, &req) != nil {
			return
		}
		s.configMu.Lock()
		updated := s.cfg
		if req.All {
			updated.TrustedDevices = nil
		} else {
			next := updated.TrustedDevices[:0]
			for _, item := range updated.TrustedDevices {
				if item.ID != req.ID {
					next = append(next, item)
				}
			}
			updated.TrustedDevices = next
		}
		err := config.Save(s.configPath, updated)
		if err == nil {
			s.cfg = updated
		}
		s.configMu.Unlock()
		if err != nil {
			writeError(w, 500, "可信设备保存失败")
			return
		}
		if req.All {
			http.SetCookie(w, &http.Cookie{Name: trustedDeviceCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: s.cfg.SecureCookie, SameSite: http.SameSiteStrictMode})
		}
		s.auditRequest(r, "auth.trusted-device.revoke", req.ID, "success", "")
		writeJSON(w, 200, map[string]bool{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func (s *Server) ipAllowlist(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.configMu.RLock()
		enabled := s.cfg.IPAllowlistEnabled
		entries := append([]string{}, s.cfg.IPAllowlist...)
		recovery := !s.cfg.IPRecoveryExpires.IsZero() && time.Now().Before(s.cfg.IPRecoveryExpires)
		s.configMu.RUnlock()
		writeJSON(w, 200, map[string]any{"enabled": enabled, "entries": entries, "current_ip": clientIP(r, s.cfg.TrustedProxy), "recovery_active": recovery})
	case http.MethodPost:
		if !s.requireElevation(w, r) {
			return
		}
		var req struct {
			Enabled bool     `json:"enabled"`
			Entries []string `json:"entries"`
		}
		if decodeJSON(w, r, 64<<10, &req) != nil {
			return
		}
		entries, err := normalizeAllowlist(req.Entries)
		if err != nil {
			writeError(w, 400, err.Error())
			return
		}
		current := clientIP(r, s.cfg.TrustedProxy)
		if req.Enabled {
			entries = ensureCurrentIP(entries, current)
			if len(entries) == 0 {
				writeError(w, 400, "无法识别当前 IP，请至少填写一个允许地址")
				return
			}
		}
		token := ""
		hash := ""
		expires := time.Time{}
		if req.Enabled {
			buf := make([]byte, 32)
			_, _ = rand.Read(buf)
			token = base64.RawURLEncoding.EncodeToString(buf)
			hash = hashToken(token)
			expires = time.Now().Add(15 * time.Minute)
		}
		s.configMu.Lock()
		updated := s.cfg
		updated.IPAllowlistEnabled = req.Enabled
		updated.IPAllowlist = entries
		updated.IPRecoveryHash = hash
		updated.IPRecoveryExpires = expires
		err = config.Save(s.configPath, updated)
		if err == nil {
			s.cfg = updated
		}
		s.configMu.Unlock()
		if err != nil {
			writeError(w, 500, "IP 允许列表保存失败")
			return
		}
		s.auditRequest(r, "security.ip-allowlist.update", strings.Join(entries, ","), "success", fmt.Sprintf("enabled=%v", req.Enabled))
		out := map[string]any{"enabled": req.Enabled, "entries": entries}
		if token != "" {
			out["recovery_token"] = token
			out["recovery_path"] = "/api/v1/security/ip-allowlist/recover?token=" + url.QueryEscape(token)
			out["expires_in"] = 900
		}
		writeJSON(w, 200, out)
	default:
		methodNotAllowed(w)
	}
}

func (s *Server) ipAllowlistRecover(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		var req struct {
			Token string `json:"token"`
		}
		if decodeJSON(w, r, 4096, &req) != nil {
			return
		}
		token = req.Token
	}
	s.configMu.Lock()
	updated := s.cfg
	if updated.IPRecoveryHash == "" || time.Now().After(updated.IPRecoveryExpires) || !subtleStringEqual(updated.IPRecoveryHash, hashToken(token)) {
		s.configMu.Unlock()
		writeError(w, 403, "恢复链接无效或已过期")
		return
	}
	updated.IPAllowlistEnabled = false
	updated.IPRecoveryHash = ""
	updated.IPRecoveryExpires = time.Time{}
	err := config.Save(s.configPath, updated)
	if err == nil {
		s.cfg = updated
	}
	s.configMu.Unlock()
	if err != nil {
		writeError(w, 500, "恢复失败")
		return
	}
	s.audit.Write(AuditEvent{IP: clientIP(r, s.cfg.TrustedProxy), User: "recovery", Action: "security.ip-allowlist.recover", Result: "success"})
	writeJSON(w, 200, map[string]any{"ok": true, "message": "IP 允许列表已关闭，现在可以重新登录"})
}

func (s *Server) ipAllowedRequest(r *http.Request) bool {
	s.configMu.RLock()
	enabled := s.cfg.IPAllowlistEnabled
	entries := append([]string{}, s.cfg.IPAllowlist...)
	s.configMu.RUnlock()
	if !enabled {
		return true
	}
	ip := net.ParseIP(strings.TrimSpace(clientIP(r, s.cfg.TrustedProxy)))
	if ip == nil {
		return false
	}
	if ip.IsLoopback() {
		return true
	}
	for _, entry := range entries {
		if strings.Contains(entry, "/") {
			_, network, err := net.ParseCIDR(entry)
			if err == nil && network.Contains(ip) {
				return true
			}
		} else if allowed := net.ParseIP(entry); allowed != nil && allowed.Equal(ip) {
			return true
		}
	}
	return false
}

func normalizeAllowlist(entries []string) ([]string, error) {
	seen := map[string]bool{}
	out := []string{}
	if len(entries) > 64 {
		return nil, errors.New("最多允许 64 个 IP 或网段")
	}
	for _, entry := range entries {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if strings.Contains(entry, "/") {
			ip, network, err := net.ParseCIDR(entry)
			if err != nil || ip == nil {
				return nil, fmt.Errorf("无效网段: %s", entry)
			}
			entry = network.String()
		} else {
			ip := net.ParseIP(entry)
			if ip == nil {
				return nil, fmt.Errorf("无效 IP: %s", entry)
			}
			entry = ip.String()
		}
		if !seen[entry] {
			seen[entry] = true
			out = append(out, entry)
		}
	}
	sort.Strings(out)
	return out, nil
}
func ensureCurrentIP(entries []string, current string) []string {
	ip := net.ParseIP(strings.Trim(strings.TrimSpace(current), "[]"))
	if ip == nil || ip.IsLoopback() {
		return entries
	}
	value := ip.String()
	for _, entry := range entries {
		if entry == value {
			return entries
		}
		if strings.Contains(entry, "/") {
			_, network, _ := net.ParseCIDR(entry)
			if network != nil && network.Contains(ip) {
				return entries
			}
		}
	}
	return append(entries, value)
}

func (s *Server) loginNotifications(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.configMu.RLock()
		enabled := s.cfg.LoginNotifyEnabled
		configured := s.cfg.TelegramBotToken != "" && s.cfg.TelegramChatID != ""
		chat := s.cfg.TelegramChatID
		s.configMu.RUnlock()
		writeJSON(w, 200, map[string]any{"enabled": enabled, "configured": configured, "chat_id": chat})
	case http.MethodPost:
		if !s.requireElevation(w, r) {
			return
		}
		var req struct {
			Enabled  bool   `json:"enabled"`
			BotToken string `json:"bot_token"`
			ChatID   string `json:"chat_id"`
			Test     bool   `json:"test"`
		}
		if decodeJSON(w, r, 16<<10, &req) != nil {
			return
		}
		req.BotToken = strings.TrimSpace(req.BotToken)
		req.ChatID = strings.TrimSpace(req.ChatID)
		s.configMu.Lock()
		updated := s.cfg
		if req.BotToken != "" {
			if !telegramTokenPattern.MatchString(req.BotToken) {
				s.configMu.Unlock()
				writeError(w, 400, "Telegram Bot Token 格式无效")
				return
			}
			updated.TelegramBotToken = req.BotToken
		}
		if req.ChatID != "" {
			if !telegramChatPattern.MatchString(req.ChatID) {
				s.configMu.Unlock()
				writeError(w, 400, "Telegram Chat ID 格式无效")
				return
			}
			updated.TelegramChatID = req.ChatID
		}
		if req.Enabled && (updated.TelegramBotToken == "" || updated.TelegramChatID == "") {
			s.configMu.Unlock()
			writeError(w, 400, "请先填写 Bot Token 和 Chat ID")
			return
		}
		updated.LoginNotifyEnabled = req.Enabled
		err := config.Save(s.configPath, updated)
		if err == nil {
			s.cfg = updated
		}
		token, chat := updated.TelegramBotToken, updated.TelegramChatID
		s.configMu.Unlock()
		if err != nil {
			writeError(w, 500, "通知配置保存失败")
			return
		}
		if req.Test {
			if err := sendTelegram(token, chat, "✅ LukePanel 登录通知测试成功"); err != nil {
				writeError(w, 400, err.Error())
				return
			}
		}
		s.auditRequest(r, "security.login-notifications", "telegram", "success", fmt.Sprintf("enabled=%v", req.Enabled))
		writeJSON(w, 200, map[string]bool{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func (s *Server) notifyLoginAsync(username, ip, userAgent, method string) {
	s.configMu.RLock()
	enabled := s.cfg.LoginNotifyEnabled
	token, chat := s.cfg.TelegramBotToken, s.cfg.TelegramChatID
	s.configMu.RUnlock()
	if !enabled || token == "" || chat == "" {
		return
	}
	message := fmt.Sprintf("🔐 LukePanel 登录成功\n账号：%s\nIP：%s\n方式：%s\n设备：%s\n时间：%s", username, ip, method, deviceName(userAgent), time.Now().Format("2006-01-02 15:04:05 MST"))
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = sendTelegramContext(ctx, token, chat, message)
	}()
}
func sendTelegram(token, chat, message string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return sendTelegramContext(ctx, token, chat, message)
}
func sendTelegramContext(ctx context.Context, token, chat, message string) error {
	endpoint := "https://api.telegram.org/bot" + token + "/sendMessage"
	payload, _ := json.Marshal(map[string]any{"chat_id": chat, "text": message, "disable_web_page_preview": true})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("无法连接 Telegram: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("Telegram 返回 HTTP %d", resp.StatusCode)
	}
	return nil
}

func hashToken(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}
func subtleStringEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
func deviceName(userAgent string) string {
	ua := strings.ToLower(userAgent)
	switch {
	case strings.Contains(ua, "iphone"):
		return "iPhone Safari"
	case strings.Contains(ua, "ipad"):
		return "iPad Safari"
	case strings.Contains(ua, "android"):
		return "Android 浏览器"
	case strings.Contains(ua, "macintosh"):
		return "Mac 浏览器"
	case strings.Contains(ua, "windows"):
		return "Windows 浏览器"
	default:
		return "浏览器设备"
	}
}
