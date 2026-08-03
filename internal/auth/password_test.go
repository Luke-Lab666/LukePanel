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
	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatalf("expected current Argon2id profile, got %q", hash)
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
	sha512Hash := legacyPBKDF2SHA512Hash("correct-horse-battery-staple", bytes.Repeat([]byte{8}, 24))
	ok, err = VerifyPassword("correct-horse-battery-staple", sha512Hash)
	if err != nil || !ok {
		t.Fatalf("v2.0.7 SHA-512 profile should verify: ok=%v err=%v", ok, err)
	}
	if !NeedsPasswordRehash(sha512Hash) {
		t.Fatal("v2.0.7 SHA-512 profile must require Argon2id migration")
	}
}

func TestVerifiedLegacyWeakPasswordCanBeRehashed(t *testing.T) {
	hash, err := RehashVerifiedPassword("legacy-weak")
	if err != nil {
		t.Fatal(err)
	}
	ok, err := VerifyPassword("legacy-weak", hash)
	if err != nil || !ok {
		t.Fatalf("rehash failed: ok=%v err=%v", ok, err)
	}
}

func TestArgon2ParametersAreBoundedBeforeAllocation(t *testing.T) {
	encoded := "$argon2id$v=19$m=1048576,t=3,p=1$MTIzNDU2Nzg5MDEyMzQ1Ng$MTIzNDU2Nzg5MDEyMzQ1Ng"
	if _, err := VerifyPassword("password", encoded); err == nil {
		t.Fatal("unbounded memory cost was accepted")
	}
}
