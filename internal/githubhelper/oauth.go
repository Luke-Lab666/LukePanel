package githubhelper

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
)

var clientIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{10,128}$`)

type DeviceCode struct {
	DeviceCode      string `json:"device_code"`
	UserCode        string `json:"user_code"`
	VerificationURI string `json:"verification_uri"`
	ExpiresIn       int    `json:"expires_in"`
	Interval        int    `json:"interval"`
}

type DevicePoll struct {
	Status           string `json:"status"`
	AccessToken      string `json:"-"`
	TokenType        string `json:"token_type,omitempty"`
	Scope            string `json:"scope,omitempty"`
	ErrorDescription string `json:"error_description,omitempty"`
	IntervalIncrease int    `json:"interval_increase,omitempty"`
}

type User struct {
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
	HTMLURL   string `json:"html_url"`
}

type Repository struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	Owner    struct {
		Login string `json:"login"`
	} `json:"owner"`
	Private       bool   `json:"private"`
	DefaultBranch string `json:"default_branch"`
	UpdatedAt     string `json:"updated_at"`
	Permissions   struct {
		Admin bool `json:"admin"`
		Push  bool `json:"push"`
		Pull  bool `json:"pull"`
	} `json:"permissions"`
}

func (c *Client) StartDeviceFlow(ctx context.Context, clientID, scope string) (DeviceCode, error) {
	clientID = strings.TrimSpace(clientID)
	if !clientIDPattern.MatchString(clientID) {
		return DeviceCode{}, errors.New("GitHub OAuth Client ID 格式不正确")
	}
	values := url.Values{"client_id": {clientID}, "scope": {strings.TrimSpace(scope)}}
	var result DeviceCode
	if err := c.formJSON(ctx, strings.TrimRight(c.webBase, "/")+"/login/device/code", values, &result); err != nil {
		return DeviceCode{}, err
	}
	if result.DeviceCode == "" || result.UserCode == "" || result.VerificationURI == "" {
		return DeviceCode{}, errors.New("GitHub 没有返回设备登录代码，请确认 OAuth App 已启用 Device Flow")
	}
	if result.Interval < 5 {
		result.Interval = 5
	}
	if result.ExpiresIn <= 0 {
		result.ExpiresIn = 900
	}
	return result, nil
}

func (c *Client) PollDeviceFlow(ctx context.Context, clientID, deviceCode string) (DevicePoll, error) {
	if !clientIDPattern.MatchString(strings.TrimSpace(clientID)) || strings.TrimSpace(deviceCode) == "" {
		return DevicePoll{}, errors.New("设备登录参数无效")
	}
	values := url.Values{
		"client_id":   {strings.TrimSpace(clientID)},
		"device_code": {strings.TrimSpace(deviceCode)},
		"grant_type":  {"urn:ietf:params:oauth:grant-type:device_code"},
	}
	var raw struct {
		AccessToken      string `json:"access_token"`
		TokenType        string `json:"token_type"`
		Scope            string `json:"scope"`
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	if err := c.formJSON(ctx, strings.TrimRight(c.webBase, "/")+"/login/oauth/access_token", values, &raw); err != nil {
		return DevicePoll{}, err
	}
	if raw.AccessToken != "" {
		return DevicePoll{Status: "authorized", AccessToken: raw.AccessToken, TokenType: raw.TokenType, Scope: raw.Scope}, nil
	}
	switch raw.Error {
	case "authorization_pending":
		return DevicePoll{Status: "pending", ErrorDescription: raw.ErrorDescription}, nil
	case "slow_down":
		return DevicePoll{Status: "pending", ErrorDescription: raw.ErrorDescription, IntervalIncrease: 5}, nil
	case "expired_token":
		return DevicePoll{Status: "expired", ErrorDescription: raw.ErrorDescription}, nil
	case "access_denied":
		return DevicePoll{Status: "denied", ErrorDescription: raw.ErrorDescription}, nil
	case "incorrect_device_code":
		return DevicePoll{Status: "expired", ErrorDescription: raw.ErrorDescription}, nil
	default:
		if raw.Error == "" {
			return DevicePoll{}, errors.New("GitHub 设备登录返回了未知结果")
		}
		return DevicePoll{}, fmt.Errorf("GitHub 登录失败：%s", firstNonEmpty(raw.ErrorDescription, raw.Error))
	}
}

func (c *Client) Repositories(ctx context.Context, token string) ([]Repository, error) {
	if strings.TrimSpace(token) == "" {
		return nil, errors.New("尚未连接 GitHub")
	}
	endpoint := strings.TrimRight(c.apiBase, "/") + "/user/repos?per_page=100&sort=updated&direction=desc&affiliation=owner,collaborator,organization_member"
	var repositories []Repository
	if err := c.requestURLJSON(ctx, http.MethodGet, endpoint, token, nil, &repositories); err != nil {
		return nil, err
	}
	return repositories, nil
}

func (c *Client) AuthenticatedUser(ctx context.Context, token string) (User, error) {
	if strings.TrimSpace(token) == "" {
		return User{}, errors.New("尚未连接 GitHub")
	}
	var user User
	if err := c.requestURLJSON(ctx, http.MethodGet, strings.TrimRight(c.apiBase, "/")+"/user", token, nil, &user); err != nil {
		return User{}, err
	}
	return user, nil
}

func (c *Client) formJSON(ctx context.Context, endpoint string, values url.Values, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "LukePanel-GitHub-Helper")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("无法连接 GitHub 登录服务：%w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("GitHub 登录服务返回 %s", resp.Status)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *Client) requestURLJSON(ctx context.Context, method, endpoint, token string, body, out any) error {
	var reader *strings.Reader
	if body == nil {
		reader = strings.NewReader("")
	} else {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = strings.NewReader(string(data))
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "LukePanel-GitHub-Helper")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(token))
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("无法连接 GitHub API：%w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return decodeGitHubError(resp)
	}
	if out == nil || resp.StatusCode == http.StatusNoContent {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return "未知错误"
}
