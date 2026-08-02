package auth

import (
	"bytes"
	"strings"
	"testing"
)

func TestPasswordRoundTrip(t *testing.T) {
	hash, err := HashPassword("correct-horse-battery-staple")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(hash, "$pbkdf2-sha512$") {
		t.Fatalf("expected current SHA-512 profile, got %q", hash)
	}
	if NeedsPasswordRehash(hash) {
		t.Fatal("current hash unexpectedly requires migration")
	}
	ok, err := VerifyPassword("correct-horse-battery-staple", hash)
	if err != nil || !ok {
		t.Fatalf("expected password to verify: ok=%v err=%v", ok, err)
	}
	ok, err = VerifyPassword("wrong-password-value", hash)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("wrong password verified")
	}
}

func TestWeakPasswordsRejected(t *testing.T) {
	for _, password := range []string{"short", "aaaaaaaaaaaa", "password1234", "lowercaseonly"} {
		if err := ValidatePasswordStrength(password, "admin"); err == nil {
			t.Fatalf("expected weak password %q to be rejected", password)
		}
	}
	if err := ValidatePasswordStrength("A much-better passphrase 2026!", "admin"); err != nil {
		t.Fatalf("expected strong passphrase: %v", err)
	}
}

func TestLegacyPasswordHashMigrates(t *testing.T) {
	hash := legacyPBKDF2Hash("correct-horse-battery-staple", bytes.Repeat([]byte{7}, 16))
	ok, err := VerifyPassword("correct-horse-battery-staple", hash)
	if err != nil || !ok {
		t.Fatalf("legacy password should verify: ok=%v err=%v", ok, err)
	}
	if !NeedsPasswordRehash(hash) {
		t.Fatal("legacy SHA-256 profile must require migration")
	}
}
