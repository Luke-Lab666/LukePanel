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
	"io"
	"net"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/config"
)

var telegramTokenPattern = regexp.MustCompile(`^[0-9]{5,16}:[A-Za-z0-9_-]{20,100}$`)
var telegramChatPattern = regexp.MustCompile(`^-?[0-9]{4,24}$`)

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
		updated := s.cfg.Clone()
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
			out["recovery_path"] = "/recover-access"
			out["expires_in"] = 900
		}
		writeJSON(w, 200, out)
	default:
		methodNotAllowed(w)
	}
}

func (s *Server) ipAllowlistRecoveryPage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = io.WriteString(w, `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LukePanel 访问恢复</title><style>body{font-family:system-ui,sans-serif;max-width:560px;margin:8vh auto;padding:24px;line-height:1.6}form{display:grid;gap:14px}input,button{font:inherit;padding:12px;border-radius:10px;border:1px solid #94a3b8}button{cursor:pointer;font-weight:700}</style></head>
<body><h1>LukePanel 访问恢复</h1><p>输入启用 IP 允许列表时保存的一次性恢复令牌。成功后，IP 允许列表会被关闭，令牌立即失效。</p>
<form method="post" action="/api/v1/security/ip-allowlist/recover"><label>恢复令牌<input name="token" type="password" autocomplete="off" required></label><button type="submit">关闭 IP 允许列表</button></form></body></html>`)
}

func (s *Server) ipAllowlistRecover(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if site := strings.ToLower(r.Header.Get("Sec-Fetch-Site")); site == "cross-site" {
		writeError(w, http.StatusForbidden, "拒绝跨站恢复请求")
		return
	}
	var token string
	if strings.HasPrefix(strings.ToLower(r.Header.Get("Content-Type")), "application/json") {
		var req struct {
			Token string `json:"token"`
		}
		if decodeJSON(w, r, 4096, &req) != nil {
			return
		}
		token = req.Token
	} else {
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		if err := r.ParseForm(); err != nil {
			writeError(w, http.StatusBadRequest, "恢复请求格式错误")
			return
		}
		token = r.FormValue("token")
	}
	token = strings.TrimSpace(token)
	if token == "" {
		writeError(w, http.StatusBadRequest, "恢复令牌不能为空")
		return
	}
	s.configMu.Lock()
	updated := s.cfg.Clone()
	if updated.IPRecoveryHash == "" || time.Now().After(updated.IPRecoveryExpires) || !subtleStringEqual(updated.IPRecoveryHash, hashToken(token)) {
		s.configMu.Unlock()
		writeError(w, http.StatusForbidden, "恢复令牌无效或已过期")
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
		writeError(w, http.StatusInternalServerError, "恢复失败")
		return
	}
	s.audit.Write(AuditEvent{IP: clientIP(r, s.cfg.TrustedProxy), User: "recovery", Action: "security.ip-allowlist.recover", Result: "success"})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "IP 允许列表已关闭，现在可以重新登录"})
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
		updated := s.cfg.Clone()
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
