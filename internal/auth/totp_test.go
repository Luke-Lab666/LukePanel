package auth

import (
	"testing"
	"time"
)

func TestTOTPVerification(t *testing.T) {
	// RFC 6238 SHA1 secret, adapted to six digits.
	secret := "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
	now := time.Unix(59, 0)
	code := totpCode(secret, now.Unix()/30)
	if len(code) != 6 || !VerifyTOTP(secret, code, now) {
		t.Fatalf("generated code %q did not verify", code)
	}
	if VerifyTOTP(secret, "000000", now) && code != "000000" {
		t.Fatal("unexpected invalid code acceptance")
	}
}

func TestRecoveryCodesAreOneTime(t *testing.T) {
	codes, err := GenerateRecoveryCodes(3)
	if err != nil {
		t.Fatal(err)
	}
	hashes := make([]string, 0, len(codes))
	for _, code := range codes {
		hashes = append(hashes, HashRecoveryCode(code, "key"))
	}
	remaining, ok := ConsumeRecoveryCode(codes[1], "key", hashes)
	if !ok || len(remaining) != 2 {
		t.Fatalf("recovery code was not consumed: ok=%v len=%d", ok, len(remaining))
	}
	if _, ok := ConsumeRecoveryCode(codes[1], "key", remaining); ok {
		t.Fatal("recovery code was accepted twice")
	}
}
