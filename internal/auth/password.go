package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	pbkdf2Iterations = 600_000
	saltLength       = 16
	keyLength        = 32
)

var commonPasswords = map[string]struct{}{
	"123456789012": {}, "1234567890": {}, "password123": {}, "password1234": {},
	"qwertyuiop123": {}, "qwerty123456": {}, "admin123456": {}, "administrator": {},
	"letmein123456": {}, "welcome123456": {}, "changeme12345": {}, "iloveyou12345": {},
	"lukepanel123": {}, "lukepanel2026": {},
}

// ValidatePasswordStrength rejects passwords that are long enough but still easy
// to guess. It deliberately avoids arbitrary complexity rules when a passphrase
// is sufficiently long, while blocking common, repeated and account-derived values.
func ValidatePasswordStrength(password, username string) error {
	length := utf8.RuneCountInString(password)
	if length < 12 {
		return errors.New("密码至少需要 12 个字符")
	}
	if length > 128 {
		return errors.New("密码不能超过 128 个字符")
	}
	trimmed := strings.TrimSpace(password)
	if trimmed != password || trimmed == "" {
		return errors.New("密码首尾不能包含空格")
	}
	lower := strings.ToLower(password)
	compact := strings.NewReplacer("-", "", "_", "", " ", "").Replace(lower)
	if _, ok := commonPasswords[compact]; ok {
		return errors.New("这个密码过于常见，请换一个更难猜的密码")
	}
	username = strings.ToLower(strings.TrimSpace(username))
	if len(username) >= 3 && strings.Contains(lower, username) {
		return errors.New("密码不能包含用户名")
	}
	if allSameRune(password) {
		return errors.New("密码不能由同一个字符重复组成")
	}
	for _, sequence := range []string{"0123456789", "1234567890", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm"} {
		if len(compact) >= 6 && strings.Contains(sequence, compact) {
			return errors.New("密码不能使用连续数字或键盘顺序")
		}
	}
	var lowerCount, upperCount, digitCount, symbolCount bool
	for _, r := range password {
		switch {
		case unicode.IsLower(r):
			lowerCount = true
		case unicode.IsUpper(r):
			upperCount = true
		case unicode.IsDigit(r):
			digitCount = true
		default:
			symbolCount = true
		}
	}
	categories := 0
	for _, present := range []bool{lowerCount, upperCount, digitCount, symbolCount} {
		if present {
			categories++
		}
	}
	// Long passphrases remain acceptable with two character classes; shorter
	// passwords must contain at least three classes.
	if (length < 16 && categories < 3) || categories < 2 {
		return errors.New("密码需要混合大小写字母、数字或符号中的至少三类；16 位以上长密码至少两类")
	}
	return nil
}

func allSameRune(value string) bool {
	var first rune
	for i, r := range value {
		if i == 0 {
			first = r
			continue
		}
		if r != first {
			return false
		}
	}
	return value != ""
}

func HashPassword(password string) (string, error) {
	if err := ValidatePasswordStrength(password, ""); err != nil {
		return "", err
	}
	salt := make([]byte, saltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := pbkdf2SHA256([]byte(password), salt, pbkdf2Iterations, keyLength)
	return fmt.Sprintf("$pbkdf2-sha256$i=%d$%s$%s", pbkdf2Iterations,
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(hash)), nil
}

func VerifyPassword(password, encoded string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 5 || parts[1] != "pbkdf2-sha256" {
		return false, errors.New("invalid password hash")
	}
	iterations, err := strconv.Atoi(strings.TrimPrefix(parts[2], "i="))
	if err != nil || iterations < 100_000 || iterations > 2_000_000 {
		return false, errors.New("invalid PBKDF2 iterations")
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false, err
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(expected) < 16 || len(expected) > 64 {
		return false, errors.New("invalid password digest")
	}
	actual := pbkdf2SHA256([]byte(password), salt, iterations, len(expected))
	return subtle.ConstantTimeCompare(actual, expected) == 1, nil
}

func pbkdf2SHA256(password, salt []byte, iterations, length int) []byte {
	hashLength := sha256.Size
	blocks := (length + hashLength - 1) / hashLength
	result := make([]byte, 0, blocks*hashLength)
	for block := 1; block <= blocks; block++ {
		mac := hmac.New(sha256.New, password)
		_, _ = mac.Write(salt)
		_, _ = mac.Write([]byte{byte(block >> 24), byte(block >> 16), byte(block >> 8), byte(block)})
		u := mac.Sum(nil)
		t := append([]byte(nil), u...)
		for i := 1; i < iterations; i++ {
			mac = hmac.New(sha256.New, password)
			_, _ = mac.Write(u)
			u = mac.Sum(nil)
			for j := range t {
				t[j] ^= u[j]
			}
		}
		result = append(result, t...)
	}
	return result[:length]
}
