package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"hash"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/Luke-Lab666/LukePanel/internal/crypto/argon2"
)

const (
	argon2MemoryKiB     uint32 = 32 * 1024
	argon2Time          uint32 = 3
	argon2Threads       uint8  = 1
	argon2SaltLength           = 24
	argon2KeyLength     uint32 = 32
	argon2MaxConcurrent        = 2

	legacySHA512Iterations = 750_000
	legacySHA256Iterations = 600_000
)

var argon2Slots = make(chan struct{}, argon2MaxConcurrent)

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

type PasswordKDFProfile struct {
	Name          string
	MemoryKiB     uint32
	Time          uint32
	Parallelism   uint8
	MaxConcurrent int
}

func CurrentPasswordKDFProfile() PasswordKDFProfile {
	return PasswordKDFProfile{Name: "Argon2id", MemoryKiB: argon2MemoryKiB, Time: argon2Time, Parallelism: argon2Threads, MaxConcurrent: argon2MaxConcurrent}
}

func HashPassword(password string) (string, error) {
	if err := ValidatePasswordStrength(password, ""); err != nil {
		return "", err
	}
	return hashPasswordArgon2id(password)
}

// RehashVerifiedPassword is only for migrating a password that has already
// passed VerifyPassword. It deliberately does not apply today's strength policy,
// so an existing installation is never locked out during an algorithm upgrade.
func RehashVerifiedPassword(password string) (string, error) {
	if password == "" {
		return "", errors.New("invalid verified password")
	}
	return hashPasswordArgon2id(password)
}

func hashPasswordArgon2id(password string) (string, error) {
	salt := make([]byte, argon2SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	digest := deriveArgon2id([]byte(password), salt, argon2Time, argon2MemoryKiB, argon2Threads, argon2KeyLength)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s", argon2.Version, argon2MemoryKiB, argon2Time, argon2Threads,
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(digest)), nil
}

func deriveArgon2id(password, salt []byte, rounds, memory uint32, parallelism uint8, keyLength uint32) []byte {
	argon2Slots <- struct{}{}
	defer func() { <-argon2Slots }()
	return argon2.IDKey(password, salt, rounds, memory, parallelism, keyLength)
}

func VerifyPassword(password, encoded string) (bool, error) {
	if strings.HasPrefix(encoded, "$argon2id$") {
		return verifyArgon2id(password, encoded)
	}
	return verifyLegacyPBKDF2(password, encoded)
}

func verifyArgon2id(password, encoded string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, errors.New("invalid Argon2id password hash")
	}
	version, err := strconv.Atoi(strings.TrimPrefix(parts[2], "v="))
	if err != nil || version != argon2.Version {
		return false, errors.New("unsupported Argon2id version")
	}
	var memory, rounds uint64
	var parallelism uint64
	parameters := strings.Split(parts[3], ",")
	if len(parameters) != 3 {
		return false, errors.New("invalid Argon2id parameters")
	}
	for _, parameter := range parameters {
		name, value, ok := strings.Cut(parameter, "=")
		if !ok {
			return false, errors.New("invalid Argon2id parameters")
		}
		parsed, parseErr := strconv.ParseUint(value, 10, 32)
		if parseErr != nil {
			return false, errors.New("invalid Argon2id parameters")
		}
		switch name {
		case "m":
			memory = parsed
		case "t":
			rounds = parsed
		case "p":
			parallelism = parsed
		default:
			return false, errors.New("invalid Argon2id parameters")
		}
	}
	// Bound attacker-controlled configuration values before allocating memory.
	if memory < 8*1024 || memory > 256*1024 || rounds < 1 || rounds > 10 || parallelism < 1 || parallelism > 8 {
		return false, errors.New("unsafe Argon2id parameters")
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) < 16 || len(salt) > 64 {
		return false, errors.New("invalid Argon2id salt")
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(expected) < 16 || len(expected) > 64 {
		return false, errors.New("invalid Argon2id digest")
	}
	actual := deriveArgon2id([]byte(password), salt, uint32(rounds), uint32(memory), uint8(parallelism), uint32(len(expected)))
	return subtle.ConstantTimeCompare(actual, expected) == 1, nil
}

func verifyLegacyPBKDF2(password, encoded string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 5 {
		return false, errors.New("invalid password hash")
	}
	iterations, err := strconv.Atoi(strings.TrimPrefix(parts[2], "i="))
	if err != nil || iterations < 100_000 || iterations > 3_000_000 {
		return false, errors.New("invalid PBKDF2 iterations")
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil || len(salt) < 16 || len(salt) > 64 {
		return false, errors.New("invalid password salt")
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(expected) < 16 || len(expected) > 128 {
		return false, errors.New("invalid password digest")
	}
	var factory func() hash.Hash
	switch parts[1] {
	case "pbkdf2-sha512":
		factory = sha512.New
	case "pbkdf2-sha256":
		factory = sha256.New
	default:
		return false, errors.New("unsupported password hash")
	}
	actual := pbkdf2([]byte(password), salt, iterations, len(expected), factory)
	return subtle.ConstantTimeCompare(actual, expected) == 1, nil
}

// NeedsPasswordRehash reports whether the stored verifier should be replaced
// after the administrator explicitly confirms the migration with the current password.
func NeedsPasswordRehash(encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" || parts[2] != fmt.Sprintf("v=%d", argon2.Version) {
		return true
	}
	profile := fmt.Sprintf("m=%d,t=%d,p=%d", argon2MemoryKiB, argon2Time, argon2Threads)
	if parts[3] != profile {
		return true
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) < argon2SaltLength {
		return true
	}
	digest, err := base64.RawStdEncoding.DecodeString(parts[5])
	return err != nil || len(digest) < int(argon2KeyLength)
}

func PasswordHashAlgorithm(encoded string) string {
	switch {
	case strings.HasPrefix(encoded, "$argon2id$"):
		return "Argon2id"
	case strings.HasPrefix(encoded, "$pbkdf2-sha512$"):
		return "PBKDF2-HMAC-SHA-512"
	case strings.HasPrefix(encoded, "$pbkdf2-sha256$"):
		return "PBKDF2-HMAC-SHA-256"
	default:
		return "未知格式"
	}
}

// legacyPBKDF2Hash is used only by migration tests and documents the previous
// profile accepted by VerifyPassword.
func legacyPBKDF2Hash(password string, salt []byte) string {
	digest := pbkdf2([]byte(password), salt, legacySHA256Iterations, 32, sha256.New)
	return fmt.Sprintf("$pbkdf2-sha256$i=%d$%s$%s", legacySHA256Iterations,
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(digest))
}

func pbkdf2(password, salt []byte, iterations, length int, factory func() hash.Hash) []byte {
	hashLength := factory().Size()
	blocks := (length + hashLength - 1) / hashLength
	result := make([]byte, 0, blocks*hashLength)
	for block := 1; block <= blocks; block++ {
		mac := hmac.New(factory, password)
		_, _ = mac.Write(salt)
		_, _ = mac.Write([]byte{byte(block >> 24), byte(block >> 16), byte(block >> 8), byte(block)})
		u := mac.Sum(nil)
		t := append([]byte(nil), u...)
		for i := 1; i < iterations; i++ {
			mac = hmac.New(factory, password)
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

func legacyPBKDF2SHA512Hash(password string, salt []byte) string {
	digest := pbkdf2([]byte(password), salt, legacySHA512Iterations, 64, sha512.New)
	return fmt.Sprintf("$pbkdf2-sha512$i=%d$%s$%s", legacySHA512Iterations,
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(digest))
}
