package server

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type githubCredential struct {
	Token       string
	Login       string
	Name        string
	AvatarURL   string
	HTMLURL     string
	Scope       string
	ConnectedAt time.Time
}

type githubDeviceFlow struct {
	Session         string
	ClientID        string
	DeviceCode      string
	UserCode        string
	VerificationURI string
	Scope           string
	ExpiresAt       time.Time
	Interval        time.Duration
	NextPoll        time.Time
}

// defaultGitHubDeviceClientID is the public OAuth client ID used by GitHub CLI.
// Device Flow does not require a client secret. A LukePanel-specific OAuth app
// can still override this value through the existing build flag or environment.
const defaultGitHubDeviceClientID = "178c6fc778ccc68e1d6a"

func (s *Server) effectiveGitHubClientID() string {
	if clientID := strings.TrimSpace(s.githubClientID); clientID != "" {
		return clientID
	}
	return defaultGitHubDeviceClientID
}

func (s *Server) githubAuthStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	session, _ := sessionFromContext(r)
	s.githubMu.Lock()
	credential, ok := s.githubTokens[session.ID]
	s.githubMu.Unlock()
	deviceAvailable := s.effectiveGitHubClientID() != ""
	if !ok {
		writeJSON(w, http.StatusOK, map[string]any{
			"connected":                 false,
			"device_login_available":    deviceAvailable,
			"device_login_configurable": false,
			"device_login_provider":     "github-cli",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"connected": true, "login": credential.Login, "name": credential.Name, "avatar_url": credential.AvatarURL,
		"html_url": credential.HTMLURL, "scope": credential.Scope, "connected_at": credential.ConnectedAt,
		"device_login_available":    deviceAvailable,
		"device_login_configurable": false,
		"device_login_provider":     "github-cli",
	})
}

func (s *Server) githubDeviceStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.cfg.SecureCookie {
		writeError(w, http.StatusBadRequest, "必须先通过 HTTPS 访问面板才能连接 GitHub")
		return
	}
	var req struct{}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	clientID := s.effectiveGitHubClientID()
	if len(clientID) < 12 || len(clientID) > 128 || strings.ContainsAny(clientID, " \t\r\n") {
		writeErrorCode(w, http.StatusServiceUnavailable, "GitHub 设备登录配置无效", "github_device_unavailable")
		return
	}
	const scope = "repo workflow read:user"
	device, err := s.github.StartDeviceFlow(r.Context(), clientID, scope)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	flowID, err := secureRandomID(18)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "无法创建 GitHub 登录流程")
		return
	}
	session, _ := sessionFromContext(r)
	flow := &githubDeviceFlow{
		Session: session.ID, ClientID: clientID, DeviceCode: device.DeviceCode,
		UserCode: device.UserCode, VerificationURI: device.VerificationURI, Scope: scope,
		ExpiresAt: time.Now().Add(time.Duration(device.ExpiresIn) * time.Second), Interval: time.Duration(device.Interval) * time.Second,
	}
	flow.NextPoll = time.Now().Add(flow.Interval)
	s.githubMu.Lock()
	for id, old := range s.githubFlows {
		if old.Session == session.ID {
			delete(s.githubFlows, id)
		}
	}
	s.githubFlows[flowID] = flow
	s.githubMu.Unlock()
	s.auditRequest(r, "github.auth.start", session.ID, "success", "device-flow")
	writeJSON(w, http.StatusOK, map[string]any{
		"flow_id": flowID, "user_code": flow.UserCode, "verification_uri": flow.VerificationURI,
		"expires_in": device.ExpiresIn, "interval": device.Interval,
	})
}

func (s *Server) githubDevicePoll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		FlowID string `json:"flow_id"`
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	session, _ := sessionFromContext(r)
	s.githubMu.Lock()
	flow := s.githubFlows[req.FlowID]
	if flow == nil || flow.Session != session.ID {
		s.githubMu.Unlock()
		writeError(w, http.StatusBadRequest, "GitHub 登录流程不存在或已过期")
		return
	}
	if time.Now().After(flow.ExpiresAt) {
		delete(s.githubFlows, req.FlowID)
		s.githubMu.Unlock()
		writeJSON(w, http.StatusOK, map[string]any{"status": "expired"})
		return
	}
	if time.Now().Before(flow.NextPoll) {
		retry := int(time.Until(flow.NextPoll).Seconds()) + 1
		s.githubMu.Unlock()
		writeJSON(w, http.StatusOK, map[string]any{"status": "pending", "retry_after": retry})
		return
	}
	clientID, deviceCode := flow.ClientID, flow.DeviceCode
	flow.NextPoll = time.Now().Add(flow.Interval)
	s.githubMu.Unlock()

	result, err := s.github.PollDeviceFlow(r.Context(), clientID, deviceCode)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	if result.IntervalIncrease > 0 {
		s.githubMu.Lock()
		if current := s.githubFlows[req.FlowID]; current != nil {
			current.Interval += time.Duration(result.IntervalIncrease) * time.Second
			current.NextPoll = time.Now().Add(current.Interval)
		}
		s.githubMu.Unlock()
	}
	if result.Status != "authorized" {
		if result.Status == "expired" || result.Status == "denied" {
			s.githubMu.Lock()
			delete(s.githubFlows, req.FlowID)
			s.githubMu.Unlock()
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": result.Status, "message": result.ErrorDescription})
		return
	}
	user, err := s.github.AuthenticatedUser(r.Context(), result.AccessToken)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	credential := githubCredential{Token: result.AccessToken, Login: user.Login, Name: user.Name, AvatarURL: user.AvatarURL, HTMLURL: user.HTMLURL, Scope: result.Scope, ConnectedAt: time.Now()}
	s.githubMu.Lock()
	s.githubTokens[session.ID] = credential
	delete(s.githubFlows, req.FlowID)
	s.githubMu.Unlock()
	s.auditRequest(r, "github.auth.connect", user.Login, "success", result.Scope)
	writeJSON(w, http.StatusOK, map[string]any{"status": "authorized", "connected": true, "login": user.Login, "name": user.Name, "avatar_url": user.AvatarURL, "scope": result.Scope})
}

func (s *Server) githubDeviceCancel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req struct {
		FlowID string `json:"flow_id"`
	}
	if decodeJSON(w, r, 16<<10, &req) != nil {
		return
	}
	session, _ := sessionFromContext(r)
	s.githubMu.Lock()
	if req.FlowID != "" {
		if flow := s.githubFlows[req.FlowID]; flow != nil && flow.Session == session.ID {
			delete(s.githubFlows, req.FlowID)
		}
	} else {
		for id, flow := range s.githubFlows {
			if flow.Session == session.ID {
				delete(s.githubFlows, id)
			}
		}
	}
	s.githubMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) githubTokenConnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.cfg.SecureCookie {
		writeError(w, http.StatusBadRequest, "必须先通过 HTTPS 访问面板才能连接 GitHub")
		return
	}
	var req struct {
		Token string `json:"token"`
	}
	if decodeJSON(w, r, 8<<10, &req) != nil {
		return
	}
	token := strings.TrimSpace(req.Token)
	if len(token) < 20 || len(token) > 512 || strings.ContainsAny(token, " \t\r\n") {
		writeError(w, http.StatusBadRequest, "GitHub Token 格式不正确")
		return
	}
	user, err := s.github.AuthenticatedUser(r.Context(), token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "GitHub Token 无效或权限不足")
		return
	}
	session, _ := sessionFromContext(r)
	credential := githubCredential{Token: token, Login: user.Login, Name: user.Name, AvatarURL: user.AvatarURL, HTMLURL: user.HTMLURL, Scope: "personal-token", ConnectedAt: time.Now()}
	s.githubMu.Lock()
	s.githubTokens[session.ID] = credential
	for id, flow := range s.githubFlows {
		if flow.Session == session.ID {
			delete(s.githubFlows, id)
		}
	}
	s.githubMu.Unlock()
	s.auditRequest(r, "github.auth.token", user.Login, "success", "memory-only")
	writeJSON(w, http.StatusOK, map[string]any{"connected": true, "login": user.Login, "name": user.Name, "avatar_url": user.AvatarURL, "scope": credential.Scope})
}

func (s *Server) githubDisconnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	session, _ := sessionFromContext(r)
	s.clearGitHubSession(session.ID)
	s.auditRequest(r, "github.auth.disconnect", session.ID, "success", "memory token removed")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) githubRepositories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	session, _ := sessionFromContext(r)
	repositories, err := s.github.Repositories(r.Context(), s.githubToken(session.ID))
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"repositories": repositories})
}

func (s *Server) githubImportPreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.cfg.SecureCookie {
		writeError(w, http.StatusBadRequest, "必须通过 HTTPS 使用 GitHub ZIP 推送")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 66<<20)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "ZIP 上传格式错误或文件超过 64MB")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "请选择 ZIP 文件")
		return
	}
	defer file.Close()
	session, _ := sessionFromContext(r)
	token := s.githubToken(session.ID)
	plan, err := s.githubImporter.Prepare(r.Context(), session.ID, strings.TrimSpace(r.FormValue("owner")), strings.TrimSpace(r.FormValue("repo")), strings.TrimSpace(r.FormValue("branch")), token, file)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	s.auditRequest(r, "github.import.preview", plan.Owner+"/"+plan.Repo+":"+plan.Branch, "success", fmt.Sprintf("+%d ~%d =%d", plan.Added, plan.Modified, plan.Unchanged))
	writeJSON(w, http.StatusOK, plan)
}

func (s *Server) githubImportCommit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if !s.requireElevation(w, r) {
		return
	}
	var req struct {
		PlanID  string `json:"plan_id"`
		Message string `json:"message"`
	}
	if decodeJSON(w, r, 32<<10, &req) != nil {
		return
	}
	session, _ := sessionFromContext(r)
	result, err := s.githubImporter.Commit(r.Context(), session.ID, req.PlanID, req.Message, s.githubToken(session.ID))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	s.auditRequest(r, "github.import.commit", result.Branch, "success", result.SHA)
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) githubToken(sessionID string) string {
	s.githubMu.Lock()
	defer s.githubMu.Unlock()
	return s.githubTokens[sessionID].Token
}

func (s *Server) clearGitHubSession(sessionID string) {
	s.githubMu.Lock()
	delete(s.githubTokens, sessionID)
	for id, flow := range s.githubFlows {
		if flow.Session == sessionID {
			delete(s.githubFlows, id)
		}
	}
	s.githubMu.Unlock()
	if s.githubImporter != nil {
		s.githubImporter.CleanupSession(sessionID)
	}
}

func secureRandomID(size int) (string, error) {
	data := make([]byte, size)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}
