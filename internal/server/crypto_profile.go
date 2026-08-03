package server

import (
	"os"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/Luke-Lab666/LukePanel/internal/auth"
)

var goRuntimeVersionPattern = regexp.MustCompile(`go1\.(\d+)`)

type cryptoRuntimeProfile struct {
	Runtime               string `json:"runtime"`
	PasswordKDF           string `json:"password_kdf"`
	PasswordMemoryMiB     int    `json:"password_memory_mib"`
	PasswordTimeCost      int    `json:"password_time_cost"`
	PasswordParallelism   int    `json:"password_parallelism"`
	PasswordMaxConcurrent int    `json:"password_max_concurrent"`
	SessionMAC            string `json:"session_mac"`
	OutboundTLS           string `json:"outbound_tls"`
	PostQuantumCapable    bool   `json:"post_quantum_capable"`
	PostQuantumDetail     string `json:"post_quantum_detail"`
	InboundTLS            string `json:"inbound_tls"`
	NegotiationRequired   bool   `json:"negotiation_required"`
}

func currentCryptoRuntimeProfile() cryptoRuntimeProfile {
	return cryptoProfileFor(runtime.Version(), os.Getenv("GODEBUG"))
}

func cryptoProfileFor(goVersion, godebug string) cryptoRuntimeProfile {
	kdf := auth.CurrentPasswordKDFProfile()
	profile := cryptoRuntimeProfile{
		Runtime:               goVersion,
		PasswordKDF:           kdf.Name,
		PasswordMemoryMiB:     int(kdf.MemoryKiB / 1024),
		PasswordTimeCost:      int(kdf.Time),
		PasswordParallelism:   int(kdf.Parallelism),
		PasswordMaxConcurrent: kdf.MaxConcurrent,
		SessionMAC:            "HMAC-SHA-512",
		InboundTLS:            "由反向代理与浏览器协商",
		NegotiationRequired:   true,
	}
	minor := 0
	if match := goRuntimeVersionPattern.FindStringSubmatch(goVersion); len(match) == 2 {
		minor, _ = strconv.Atoi(match[1])
	}
	disableAll := godebugValue(godebug, "tlsmlkem") == "0"
	disableSecP := godebugValue(godebug, "tlssecpmlkem") == "0"
	switch {
	case minor >= 26 && !disableAll && !disableSecP:
		profile.OutboundTLS = "X25519MLKEM768 + SecP256r1MLKEM768 + SecP384r1MLKEM1024"
		profile.PostQuantumCapable = true
		profile.PostQuantumDetail = "出站 HTTPS 优先协商三组传统算法 + ML-KEM 后量子混合密钥交换；对端不支持时自动兼容回退"
	case minor >= 24 && !disableAll:
		profile.OutboundTLS = "X25519MLKEM768"
		profile.PostQuantumCapable = true
		if minor >= 26 && disableSecP {
			profile.PostQuantumDetail = "SecP 混合组已被 GODEBUG 关闭，仍保留 X25519 + ML-KEM-768 混合密钥交换"
		} else {
			profile.PostQuantumDetail = "出站 HTTPS 支持 X25519 + ML-KEM-768 混合密钥交换；使用官方 Go 1.26.5 Release 可获得完整三组混合方案"
		}
	default:
		profile.OutboundTLS = "当前构建未启用 ML-KEM 混合 TLS"
		profile.PostQuantumCapable = false
		if disableAll {
			profile.PostQuantumDetail = "GODEBUG=tlsmlkem=0 已关闭后量子混合密钥交换"
		} else {
			profile.PostQuantumDetail = "请安装官方 v2.0.8 Release；源码自行构建时使用 Go 1.26.5 或更高安全修订版"
		}
	}
	return profile
}

func godebugValue(value, key string) string {
	result := ""
	for _, item := range strings.Split(value, ",") {
		name, current, ok := strings.Cut(strings.TrimSpace(item), "=")
		if ok && name == key {
			result = current
		}
	}
	return result
}
