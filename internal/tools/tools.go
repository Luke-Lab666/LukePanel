package tools

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var hostPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,253}$`)

type Result struct {
	Tool       string   `json:"tool"`
	Target     string   `json:"target"`
	Output     string   `json:"output"`
	Addresses  []string `json:"addresses,omitempty"`
	DurationMS int64    `json:"duration_ms"`
	Success    bool     `json:"success"`
}

func Run(ctx context.Context, tool, target string, port int) (Result, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return Result{}, errors.New("目标不能为空")
	}
	started := time.Now()
	result := Result{Tool: tool, Target: target}
	var err error
	switch tool {
	case "ping":
		result.Output, err = ping(ctx, target)
	case "dns":
		result.Addresses, err = dns(ctx, target)
		result.Output = strings.Join(result.Addresses, "\n")
	case "tcp":
		if port < 1 || port > 65535 {
			return Result{}, errors.New("端口必须在 1–65535 之间")
		}
		result.Output, err = tcp(ctx, target, port)
	case "http":
		result.Output, err = httpCheck(ctx, target)
	default:
		return Result{}, errors.New("不支持的工具")
	}
	result.DurationMS = time.Since(started).Milliseconds()
	result.Success = err == nil
	return result, err
}

func ping(parent context.Context, host string) (string, error) {
	if !validHost(host) {
		return "", errors.New("目标格式不正确")
	}
	ctx, cancel := context.WithTimeout(parent, 12*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ping", "-c", "4", "-W", "2", host)
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	err := cmd.Run()
	if ctx.Err() != nil {
		return out.String(), errors.New("Ping 超时")
	}
	if err != nil {
		return out.String(), fmt.Errorf("Ping 失败")
	}
	return out.String(), nil
}

func dns(parent context.Context, host string) ([]string, error) {
	if !validHost(host) {
		return nil, errors.New("域名格式不正确")
	}
	ctx, cancel := context.WithTimeout(parent, 8*time.Second)
	defer cancel()
	addresses, err := net.DefaultResolver.LookupHost(ctx, strings.TrimSuffix(host, "."))
	if err != nil {
		return nil, err
	}
	return addresses, nil
}

func tcp(parent context.Context, host string, port int) (string, error) {
	if !validHost(host) {
		return "", errors.New("目标格式不正确")
	}
	ctx, cancel := context.WithTimeout(parent, 8*time.Second)
	defer cancel()
	start := time.Now()
	conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", net.JoinHostPort(host, strconv.Itoa(port)))
	if err != nil {
		return "", err
	}
	conn.Close()
	return fmt.Sprintf("连接成功\n目标：%s\n耗时：%d ms", net.JoinHostPort(host, strconv.Itoa(port)), time.Since(start).Milliseconds()), nil
}

func httpCheck(parent context.Context, target string) (string, error) {
	if !strings.Contains(target, "://") {
		target = "https://" + target
	}
	u, err := url.Parse(target)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" {
		return "", errors.New("URL 格式不正确")
	}
	if blockedHost(u.Hostname()) {
		return "", errors.New("禁止访问本机、链路本地或元数据地址")
	}
	ctx, cancel := context.WithTimeout(parent, 12*time.Second)
	defer cancel()
	transport := &http.Transport{Proxy: nil, DialContext: (&net.Dialer{Timeout: 5 * time.Second}).DialContext, TLSHandshakeTimeout: 5 * time.Second, DisableKeepAlives: true}
	client := &http.Client{Transport: transport, Timeout: 12 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return errors.New("重定向次数过多")
		}
		if blockedHost(req.URL.Hostname()) {
			return errors.New("重定向目标被阻止")
		}
		return nil
	}}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	req.Header.Set("User-Agent", "LukePanel/1.0")
	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	resp.Body.Close()
	return fmt.Sprintf("状态：%s\n最终地址：%s\n耗时：%d ms\n服务器：%s", resp.Status, resp.Request.URL.String(), time.Since(start).Milliseconds(), resp.Header.Get("Server")), nil
}

func validHost(host string) bool {
	if strings.ContainsAny(host, " /\\\t\n\r") || !hostPattern.MatchString(host) {
		return false
	}
	return true
}

func blockedHost(host string) bool {
	lower := strings.ToLower(strings.TrimSuffix(host, "."))
	if lower == "localhost" || strings.HasSuffix(lower, ".localhost") || lower == "metadata.google.internal" {
		return true
	}
	if addr, err := netip.ParseAddr(lower); err == nil {
		return addr.IsLoopback() || addr.IsLinkLocalUnicast() || addr.IsLinkLocalMulticast() || addr.IsUnspecified() || addr.IsMulticast() || addr == netip.MustParseAddr("169.254.169.254")
	}
	return false
}
