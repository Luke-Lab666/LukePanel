package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

func GenerateTOTPSecret() (string, error) {
	data := make([]byte, 20)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(data), nil
}

func VerifyTOTP(secret, code string, now time.Time) bool {
	code = normalizeOneTimeCode(code)
	if len(code) != 6 {
		return false
	}
	for offset := int64(-1); offset <= 1; offset++ {
		if totpCode(secret, now.Unix()/30+offset) == code {
			return true
		}
	}
	return false
}

func totpCode(secret string, counter int64) string {
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(strings.TrimSpace(secret)))
	if err != nil || len(key) == 0 {
		return ""
	}
	var message [8]byte
	binary.BigEndian.PutUint64(message[:], uint64(counter))
	mac := hmac.New(sha1.New, key)
	_, _ = mac.Write(message[:])
	digest := mac.Sum(nil)
	offset := digest[len(digest)-1] & 0x0f
	value := binary.BigEndian.Uint32(digest[offset:offset+4]) & 0x7fffffff
	return fmt.Sprintf("%06d", value%1000000)
}

func GenerateRecoveryCodes(count int) ([]string, error) {
	if count < 1 || count > 20 {
		return nil, errors.New("recovery code count out of range")
	}
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	out := make([]string, 0, count)
	for len(out) < count {
		raw := make([]byte, 12)
		if _, err := rand.Read(raw); err != nil {
			return nil, err
		}
		chars := make([]byte, len(raw))
		for i, value := range raw {
			chars[i] = alphabet[int(value)%len(alphabet)]
		}
		out = append(out, string(chars[:4])+"-"+string(chars[4:8])+"-"+string(chars[8:]))
	}
	return out, nil
}

func HashRecoveryCode(code, key string) string {
	mac := hmac.New(sha512.New, []byte(key))
	_, _ = mac.Write([]byte(normalizeRecoveryCode(code)))
	return "sha512:" + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func legacyRecoveryCodeHash(code, key string) string {
	mac := hmac.New(sha256.New, []byte(key))
	_, _ = mac.Write([]byte(normalizeRecoveryCode(code)))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func ConsumeRecoveryCode(code, key string, hashes []string) ([]string, bool) {
	candidates := []string{HashRecoveryCode(code, key), legacyRecoveryCodeHash(code, key)}
	for i, stored := range hashes {
		for _, candidate := range candidates {
			if hmac.Equal([]byte(candidate), []byte(stored)) {
				out := append([]string(nil), hashes[:i]...)
				out = append(out, hashes[i+1:]...)
				return out, true
			}
		}
	}
	return hashes, false
}

func normalizeOneTimeCode(value string) string {
	var b strings.Builder
	for _, r := range strings.TrimSpace(value) {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func normalizeRecoveryCode(value string) string {
	value = strings.ToUpper(strings.TrimSpace(value))
	var b strings.Builder
	for _, r := range value {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func FormatOTPAuthURI(account, issuer, secret string) string {
	account = strings.TrimSpace(account)
	issuer = strings.TrimSpace(issuer)
	label := url.PathEscape(issuer + ":" + account)
	query := url.Values{"secret": {secret}, "issuer": {issuer}, "algorithm": {"SHA1"}, "digits": {"6"}, "period": {"30"}}
	return "otpauth://totp/" + label + "?" + query.Encode()
}
