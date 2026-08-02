package server

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Luke-Lab666/LukePanel/internal/auth"
	"github.com/Luke-Lab666/LukePanel/internal/config"
)

type totpPendingSetup struct {
	Secret    string
	Codes     []string
	ExpiresAt time.Time
}

func (s *Server) totpStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	s.configMu.RLock()
	enabled := s.cfg.TOTPSecret != ""
	recoveryCount := len(s.cfg.RecoveryCodeHashes)
	s.configMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{"enabled": enabled, "recovery_codes_remaining": recoveryCount})
}

func (s *Server) totpSetup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	s.configMu.RLock()
	alreadyEnabled := s.cfg.TOTPSecret != ""
	username := s.cfg.AdminUser
	s.configMu.RUnlock()
	if alreadyEnabled {
		writeError(w, http.StatusConflict, "两步验证已经开启，请先关闭后再重新设置")
		return
	}
	secret, err := auth.GenerateTOTPSecret()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "无法生成两步验证密钥")
		return
	}
	codes, err := auth.GenerateRecoveryCodes(10)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "无法生成恢复码")
		return
	}
	session, _ := sessionFromContext(r)
	s.totpMu.Lock()
	s.totpPending[session.ID] = totpPendingSetup{Secret: secret, Codes: codes, ExpiresAt: time.Now().Add(10 * time.Minute)}
	s.totpMu.Unlock()
	s.auditRequest(r, "auth.totp.setup.start", session.ID, "success", "10m")
	writeJSON(w, http.StatusOK, map[string]any{
		"secret":         secret,
		"otpauth_uri":    auth.FormatOTPAuthURI(username, "LukePanel", secret),
		"recovery_codes": codes,
		"expires_in":     600,
	})
}

func (s *Server) totpConfirm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req struct {
		Code string `json:"code"`
	}
	if decodeJSON(w, r, 4096, &req) != nil {
		return
	}
	session, _ := sessionFromContext(r)
	s.totpMu.Lock()
	pending, ok := s.totpPending[session.ID]
	if ok && time.Now().After(pending.ExpiresAt) {
		delete(s.totpPending, session.ID)
		ok = false
	}
	s.totpMu.Unlock()
	if !ok {
		writeError(w, http.StatusBadRequest, "两步验证设置已过期，请重新开始")
		return
	}
	if !auth.VerifyTOTP(pending.Secret, req.Code, time.Now()) {
		s.auditRequest(r, "auth.totp.setup.confirm", session.ID, "failed", "invalid code")
		writeError(w, http.StatusUnauthorized, "验证码不正确，请确认服务器和手机时间准确")
		return
	}
	s.configMu.Lock()
	updated := s.cfg.Clone()
	updated.TOTPSecret = pending.Secret
	updated.RecoveryCodeHashes = make([]string, 0, len(pending.Codes))
	for _, code := range pending.Codes {
		updated.RecoveryCodeHashes = append(updated.RecoveryCodeHashes, auth.HashRecoveryCode(code, updated.SessionSecret))
	}
	err := config.Save(s.configPath, updated)
	if err == nil {
		s.cfg = updated
	}
	s.configMu.Unlock()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "两步验证设置保存失败")
		return
	}
	s.totpMu.Lock()
	delete(s.totpPending, session.ID)
	s.totpMu.Unlock()
	s.auditRequest(r, "auth.totp.enable", session.ID, "success", "")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) totpDisable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	s.configMu.Lock()
	updated := s.cfg.Clone()
	updated.TOTPSecret = ""
	updated.RecoveryCodeHashes = nil
	err := config.Save(s.configPath, updated)
	if err == nil {
		s.cfg = updated
	}
	s.configMu.Unlock()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "关闭两步验证失败")
		return
	}
	session, _ := sessionFromContext(r)
	s.auditRequest(r, "auth.totp.disable", session.ID, "success", "")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) totpRegenerateRecovery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	codes, err := auth.GenerateRecoveryCodes(10)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "无法生成恢复码")
		return
	}
	s.configMu.Lock()
	updated := s.cfg.Clone()
	updated.RecoveryCodeHashes = make([]string, 0, len(codes))
	for _, code := range codes {
		updated.RecoveryCodeHashes = append(updated.RecoveryCodeHashes, auth.HashRecoveryCode(code, updated.SessionSecret))
	}
	err = config.Save(s.configPath, updated)
	if err == nil {
		s.cfg = updated
	}
	s.configMu.Unlock()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "恢复码保存失败")
		return
	}
	session, _ := sessionFromContext(r)
	s.auditRequest(r, "auth.totp.recovery.regenerate", session.ID, "success", "10 codes")
	writeJSON(w, http.StatusOK, map[string]any{"recovery_codes": codes})
}

// verifySecondFactor validates a six-digit TOTP or a one-time recovery code.
// When consumeRecovery is true, a matching recovery code is removed atomically.
func (s *Server) verifySecondFactor(code string, consumeRecovery bool) (bool, bool, error) {
	code = strings.TrimSpace(code)
	s.configMu.Lock()
	defer s.configMu.Unlock()
	if s.cfg.TOTPSecret == "" {
		return true, false, nil
	}
	if auth.VerifyTOTP(s.cfg.TOTPSecret, code, time.Now()) {
		return true, false, nil
	}
	remaining, used := auth.ConsumeRecoveryCode(code, s.cfg.SessionSecret, s.cfg.RecoveryCodeHashes)
	if !used {
		return false, false, nil
	}
	if !consumeRecovery {
		return true, true, nil
	}
	updated := s.cfg.Clone()
	updated.RecoveryCodeHashes = remaining
	if err := config.Save(s.configPath, updated); err != nil {
		return false, false, err
	}
	s.cfg = updated
	return true, true, nil
}

// saveConfigWithSecondFactor verifies the currently configured second factor and
// persists the requested mutation in one config transaction. Recovery codes are
// consumed only when the final configuration save succeeds.
func (s *Server) saveConfigWithSecondFactor(code string, mutate func(*config.Config) error) (bool, error) {
	code = strings.TrimSpace(code)
	s.configMu.Lock()
	defer s.configMu.Unlock()

	updated := s.cfg.Clone()
	recoveryUsed := false
	if updated.TOTPSecret != "" {
		if code == "" {
			return false, errSecondFactorRequired
		}
		if !auth.VerifyTOTP(updated.TOTPSecret, code, time.Now()) {
			remaining, used := auth.ConsumeRecoveryCode(code, updated.SessionSecret, updated.RecoveryCodeHashes)
			if !used {
				return false, errSecondFactorInvalid
			}
			updated.RecoveryCodeHashes = remaining
			recoveryUsed = true
		}
	}
	if err := mutate(&updated); err != nil {
		return false, err
	}
	if err := config.Save(s.configPath, updated); err != nil {
		return false, err
	}
	s.cfg = updated
	return recoveryUsed, nil
}

func (s *Server) totpEnabled() bool {
	s.configMu.RLock()
	defer s.configMu.RUnlock()
	return s.cfg.TOTPSecret != ""
}

func isSecondFactorMissing(code string) bool {
	return strings.TrimSpace(code) == ""
}

var (
	errSecondFactorRequired = errors.New("second factor required")
	errSecondFactorInvalid  = errors.New("second factor invalid")
	errConfigChanged        = errors.New("configuration changed")
)
