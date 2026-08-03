package server

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/auth"
	"github.com/Luke-Lab666/LukePanel/internal/config"
)

type passkeyChallenge struct {
	Challenge string
	Origin    string
	RPID      string
	Username  string
	SessionID string
	Kind      string
	SourceIP  string
	ExpiresAt time.Time
}

func (s *Server) passkeyLoginBegin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	ip := clientIP(r, s.cfg.TrustedProxy)
	if allowed, retry := s.limiter.Allowed(ip); !allowed {
		w.Header().Set("Retry-After", fmt.Sprintf("%.0f", retry.Seconds()))
		writeError(w, http.StatusTooManyRequests, "登录尝试过多，请稍后再试")
		return
	}
	if !s.ipAllowedRequest(r) {
		writeError(w, http.StatusForbidden, "当前 IP 不在面板允许列表中")
		return
	}
	s.configMu.RLock()
	adminUser := s.cfg.AdminUser
	credentials := append([]auth.PasskeyCredential{}, s.cfg.Passkeys...)
	s.configMu.RUnlock()
	if len(credentials) == 0 {
		writeError(w, http.StatusBadRequest, "当前面板尚未配置 Passkey")
		return
	}
	challenge, err := auth.RandomChallenge(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "无法生成 Passkey 登录挑战")
		return
	}
	flowID, err := auth.RandomChallenge(18)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "无法生成 Passkey 登录流程")
		return
	}
	origin, rpID := s.webauthnContext(r)
	s.passkeyMu.Lock()
	s.cleanupPasskeyChallengesLocked()
	pendingForIP := 0
	for _, item := range s.passkeyPending {
		if item.Kind == "login" && item.SourceIP == ip {
			pendingForIP++
		}
	}
	if pendingForIP >= 5 {
		s.passkeyMu.Unlock()
		writeError(w, http.StatusTooManyRequests, "Passkey 登录请求过多，请完成或稍后重试")
		return
	}
	if len(s.passkeyPending) >= 256 {
		s.passkeyMu.Unlock()
		writeError(w, http.StatusServiceUnavailable, "Passkey 登录暂时繁忙，请稍后重试")
		return
	}
	s.passkeyPending[flowID] = passkeyChallenge{Challenge: challenge, Origin: origin, RPID: rpID, Username: adminUser, Kind: "login", SourceIP: ip, ExpiresAt: time.Now().Add(5 * time.Minute)}
	s.passkeyMu.Unlock()
	allow := make([]map[string]any, 0, len(credentials))
	for _, credential := range credentials {
		allow = append(allow, map[string]any{"type": "public-key", "id": credential.ID, "transports": []string{"internal", "hybrid", "usb", "nfc", "ble"}})
	}
	writeJSON(w, 200, map[string]any{"flow_id": flowID, "challenge": challenge, "rp_id": rpID, "timeout": 60000, "user_verification": "required", "allow_credentials": allow})
}

func (s *Server) passkeyLoginFinish(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	ip := clientIP(r, s.cfg.TrustedProxy)
	if allowed, retry := s.limiter.Allowed(ip); !allowed {
		w.Header().Set("Retry-After", fmt.Sprintf("%.0f", retry.Seconds()))
		writeError(w, http.StatusTooManyRequests, "登录尝试过多，请稍后再试")
		return
	}
	if !s.ipAllowedRequest(r) {
		writeError(w, http.StatusForbidden, "当前 IP 不在面板允许列表中")
		return
	}
	var req struct {
		FlowID     string                        `json:"flow_id"`
		Credential auth.PasskeyAssertionResponse `json:"credential"`
	}
	if decodeJSON(w, r, 1<<20, &req) != nil {
		s.limiter.Fail(ip)
		return
	}
	s.passkeyMu.Lock()
	challenge, ok := s.passkeyPending[req.FlowID]
	if ok {
		delete(s.passkeyPending, req.FlowID)
	}
	s.passkeyMu.Unlock()
	if !ok || challenge.Kind != "login" || time.Now().After(challenge.ExpiresAt) {
		s.limiter.Fail(ip)
		s.audit.Write(AuditEvent{IP: ip, User: "passkey", Action: "auth.passkey.login", Result: "failed", Detail: "expired or unknown flow"})
		writeError(w, http.StatusUnauthorized, "Passkey 登录请求已过期")
		return
	}
	s.configMu.RLock()
	credentials := append([]auth.PasskeyCredential{}, s.cfg.Passkeys...)
	s.configMu.RUnlock()
	id := strings.TrimSpace(req.Credential.RawID)
	if id == "" {
		id = req.Credential.ID
	}
	index := -1
	for i, item := range credentials {
		if item.ID == id {
			index = i
			break
		}
	}
	if index < 0 {
		s.limiter.Fail(ip)
		writeError(w, http.StatusUnauthorized, "Passkey 不存在或已移除")
		return
	}
	count, err := auth.VerifyPasskey(req.Credential, credentials[index], challenge.Challenge, challenge.Origin, challenge.RPID)
	if err != nil {
		s.limiter.Fail(ip)
		s.audit.Write(AuditEvent{IP: ip, User: challenge.Username, Action: "auth.passkey.login", Result: "failed", Detail: err.Error()})
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	s.configMu.Lock()
	updated := s.cfg.Clone()
	if updated.WebAuthnOrigin == "" && updated.WebAuthnRPID == "" {
		updated.WebAuthnOrigin = challenge.Origin
		updated.WebAuthnRPID = challenge.RPID
	}
	found := false
	for i := range updated.Passkeys {
		if updated.Passkeys[i].ID == credentials[index].ID {
			updated.Passkeys[i].SignCount = count
			updated.Passkeys[i].LastUsed = time.Now().UTC()
			found = true
			break
		}
	}
	if !found {
		s.configMu.Unlock()
		s.limiter.Fail(ip)
		writeError(w, http.StatusUnauthorized, "Passkey 已在登录过程中被移除")
		return
	}
	saveErr := config.Save(s.configPath, updated)
	if saveErr == nil {
		s.cfg = updated
	}
	s.configMu.Unlock()
	if saveErr != nil {
		writeError(w, 500, "Passkey 状态保存失败")
		return
	}
	s.establishSession(w, r, challenge.Username, "auth.passkey.login")
}

func (s *Server) passkeyRegisterBegin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if decodeJSON(w, r, 4096, &req) != nil {
		return
	}
	session, _ := sessionFromContext(r)
	challenge, err := auth.RandomChallenge(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "无法生成 Passkey 注册挑战")
		return
	}
	flowID, err := auth.RandomChallenge(18)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "无法生成 Passkey 注册流程")
		return
	}
	origin, rpID := s.webauthnContext(r)
	s.configMu.RLock()
	sessionSecret, trustedProxy := s.cfg.SessionSecret, s.cfg.TrustedProxy
	credentials := append([]auth.PasskeyCredential(nil), s.cfg.Passkeys...)
	s.configMu.RUnlock()
	userHash := sha256.Sum256([]byte("lukepanel:" + session.Username + ":" + sessionSecret))
	userID := base64.RawURLEncoding.EncodeToString(userHash[:16])
	s.passkeyMu.Lock()
	s.cleanupPasskeyChallengesLocked()
	pendingForSession := 0
	for _, item := range s.passkeyPending {
		if item.Kind == "register" && item.SessionID == session.ID {
			pendingForSession++
		}
	}
	if pendingForSession >= 5 {
		s.passkeyMu.Unlock()
		writeError(w, http.StatusTooManyRequests, "Passkey 注册请求过多，请完成或稍后重试")
		return
	}
	if len(s.passkeyPending) >= 256 {
		s.passkeyMu.Unlock()
		writeError(w, http.StatusServiceUnavailable, "Passkey 服务暂时繁忙，请稍后重试")
		return
	}
	s.passkeyPending[flowID] = passkeyChallenge{Challenge: challenge, Origin: origin, RPID: rpID, Username: session.Username, SessionID: session.ID, Kind: "register", SourceIP: clientIP(r, trustedProxy), ExpiresAt: time.Now().Add(5 * time.Minute)}
	s.passkeyMu.Unlock()
	exclude := make([]map[string]any, 0, len(credentials))
	for _, credential := range credentials {
		exclude = append(exclude, map[string]any{"type": "public-key", "id": credential.ID})
	}
	writeJSON(w, 200, map[string]any{"flow_id": flowID, "challenge": challenge, "rp": map[string]any{"name": "LukePanel", "id": rpID}, "user": map[string]any{"id": userID, "name": session.Username, "display_name": session.Username}, "pub_key_cred_params": []map[string]any{{"type": "public-key", "alg": -7}}, "timeout": 60000, "attestation": "none", "authenticator_selection": map[string]any{"resident_key": "required", "user_verification": "required"}, "exclude_credentials": exclude, "name": strings.TrimSpace(req.Name)})
}

func (s *Server) passkeyRegisterFinish(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req struct {
		FlowID     string                       `json:"flow_id"`
		Name       string                       `json:"name"`
		Credential auth.PasskeyCreationResponse `json:"credential"`
	}
	if decodeJSON(w, r, 2<<20, &req) != nil {
		return
	}
	session, _ := sessionFromContext(r)
	s.passkeyMu.Lock()
	challenge, ok := s.passkeyPending[req.FlowID]
	if ok {
		delete(s.passkeyPending, req.FlowID)
	}
	s.passkeyMu.Unlock()
	if !ok || challenge.Kind != "register" || challenge.SessionID != session.ID || time.Now().After(challenge.ExpiresAt) {
		writeError(w, 400, "Passkey 注册请求已过期")
		return
	}
	credential, err := auth.RegisterPasskey(req.Credential, challenge.Challenge, challenge.Origin, challenge.RPID, req.Name)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	s.configMu.Lock()
	updated := s.cfg.Clone()
	if updated.WebAuthnOrigin == "" && updated.WebAuthnRPID == "" {
		updated.WebAuthnOrigin = challenge.Origin
		updated.WebAuthnRPID = challenge.RPID
	}
	for _, existing := range updated.Passkeys {
		if existing.ID == credential.ID {
			s.configMu.Unlock()
			writeError(w, 409, "这个 Passkey 已经注册")
			return
		}
	}
	if len(updated.Passkeys) >= 12 {
		s.configMu.Unlock()
		writeError(w, 400, "最多保留 12 个 Passkey")
		return
	}
	updated.Passkeys = append(updated.Passkeys, credential)
	err = config.Save(s.configPath, updated)
	if err == nil {
		s.cfg = updated
	}
	s.configMu.Unlock()
	if err != nil {
		writeError(w, 500, "Passkey 保存失败")
		return
	}
	s.auditRequest(r, "auth.passkey.register", credential.Name, "success", credential.ID[:minPasskey(12, len(credential.ID))])
	writeJSON(w, 200, credential)
}

func (s *Server) passkeyManagement(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.configMu.RLock()
		items := append([]auth.PasskeyCredential{}, s.cfg.Passkeys...)
		s.configMu.RUnlock()
		writeJSON(w, 200, map[string]any{"passkeys": items})
	case http.MethodDelete:
		if !s.requireElevation(w, r) {
			return
		}
		var req struct {
			ID string `json:"id"`
		}
		if decodeJSON(w, r, 4096, &req) != nil {
			return
		}
		s.configMu.Lock()
		updated := s.cfg.Clone()
		next := updated.Passkeys[:0]
		found := false
		for _, item := range updated.Passkeys {
			if item.ID == req.ID {
				found = true
				continue
			}
			next = append(next, item)
		}
		updated.Passkeys = next
		if !found {
			s.configMu.Unlock()
			writeError(w, 404, "Passkey 不存在")
			return
		}
		err := config.Save(s.configPath, updated)
		if err == nil {
			s.cfg = updated
		}
		s.configMu.Unlock()
		if err != nil {
			writeError(w, 500, "Passkey 删除失败")
			return
		}
		s.auditRequest(r, "auth.passkey.delete", req.ID, "success", "")
		writeJSON(w, 200, map[string]bool{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func (s *Server) establishSession(w http.ResponseWriter, r *http.Request, username, action string) {
	s.limiter.Success(clientIP(r, s.cfg.TrustedProxy))
	token, session, err := s.sessions.Create(username)
	if err != nil {
		writeError(w, 500, "无法创建会话")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "lukepanel_session", Value: token, Path: "/", HttpOnly: true, Secure: s.cfg.SecureCookie, SameSite: http.SameSiteStrictMode, MaxAge: 86400})
	s.expireLegacyTrustedDeviceCookie(w)
	ip := clientIP(r, s.cfg.TrustedProxy)
	s.audit.Write(AuditEvent{IP: ip, User: username, Action: action, Target: session.ID, Result: "success"})
	s.notifyLoginAsync(username, ip, r.UserAgent(), action)
	required, algorithm := s.passwordUpgradeStatus()
	writeJSON(w, 200, map[string]any{"username": username, "csrf_token": session.CSRFToken, "session_id": session.ID, "totp_enabled": s.totpEnabled(), "password_upgrade_required": required, "password_hash_algorithm": algorithm})
}

func (s *Server) webauthnContext(r *http.Request) (string, string) {
	s.configMu.RLock()
	pinnedOrigin := strings.TrimSpace(s.cfg.WebAuthnOrigin)
	pinnedRPID := strings.TrimSpace(s.cfg.WebAuthnRPID)
	secureCookie, trustedProxy := s.cfg.SecureCookie, s.cfg.TrustedProxy
	s.configMu.RUnlock()
	if pinnedOrigin != "" && pinnedRPID != "" {
		return pinnedOrigin, pinnedRPID
	}
	host := r.Host
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.TrimSuffix(strings.ToLower(strings.Trim(host, "[]")), ".")
	scheme := "http"
	if secureCookie {
		scheme = "https"
	}
	remote, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remote = strings.Trim(strings.TrimSpace(r.RemoteAddr), "[]")
	}
	remoteIP := net.ParseIP(remote)
	trustedSource := remoteIP != nil && remoteIP.IsLoopback()
	if !trustedSource && trustedProxy != "" {
		trustedSource = proxyAddressMatches(remote, trustedProxy)
	}
	if trustedSource {
		if forwarded := strings.ToLower(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto"))); forwarded == "http" || forwarded == "https" {
			scheme = forwarded
		}
	}
	return scheme + "://" + host, host
}
func (s *Server) cleanupPasskeyChallengesLocked() {
	now := time.Now()
	for id, item := range s.passkeyPending {
		if now.After(item.ExpiresAt) {
			delete(s.passkeyPending, id)
		}
	}
}
func minPasskey(a, b int) int {
	if a < b {
		return a
	}
	return b
}

var errPasskeyUnavailable = errors.New("passkey unavailable")
